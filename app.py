from flask import Flask, render_template, request, jsonify, send_file, send_from_directory
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
import qrcode
import json
import os
from database import UniversalExcelManager

app = Flask(__name__)
app.secret_key = 'universal-store-secret-key'

excel_manager = UniversalExcelManager()

os.makedirs('static/bills', exist_ok=True)
os.makedirs('static/qr_codes', exist_ok=True)

def generate_qr_code(bill_no, data_dict):
    qr = qrcode.QRCode(version=2, error_correction=qrcode.constants.ERROR_CORRECT_H,
                       box_size=10, border=4)
    qr.add_data(json.dumps(data_dict))
    qr.make(fit=True)
    img = qr.make_image(fill_color="#2C3E50", back_color="white")
    filename = f"qr_{bill_no}.png"
    filepath = os.path.join('static', 'qr_codes', filename)
    img.save(filepath, 'PNG')
    return filename

@app.route('/')
def index():
    preview_bill_no = excel_manager.generate_bill_no()
    current_date = datetime.now().strftime("%d %B, %Y")
    summary = excel_manager.generate_summary_report()
    store_settings = excel_manager.get_store_settings()
    return render_template('index.html',
                           preview_bill_no=preview_bill_no,
                           current_date=current_date,
                           summary=summary,
                           store=store_settings)

@app.route('/generate_bill_no')
def generate_bill_no():
    return jsonify({'bill_no': excel_manager.generate_bill_no()})

@app.route('/get_profit_margin')
def get_profit_margin():
    return jsonify({'margin': excel_manager.get_profit_margin()})

@app.route('/set_profit_margin', methods=['POST'])
def set_profit_margin():
    data = request.json
    margin = float(data.get('margin', 30))
    excel_manager.set_profit_margin(margin)
    return jsonify({'success': True})

@app.route('/get_store_settings')
def get_store_settings():
    return jsonify({'success': True, 'settings': excel_manager.get_store_settings()})

@app.route('/update_store_settings', methods=['POST'])
def update_store_settings():
    try:
        data = request.json
        allowed_keys = ['store_name', 'store_tagline', 'store_address',
                        'store_phone', 'store_email', 'store_website',
                        'currency_symbol', 'profit_margin']
        filtered = {k: v for k, v in data.items() if k in allowed_keys}
        excel_manager.update_store_settings(filtered)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/generate_customer_id', methods=['POST'])
def generate_customer_id():
    data = request.json
    name = data.get('customer_name', '')
    cid = excel_manager.get_or_create_customer_id(name)
    return jsonify({'customer_id': cid})

@app.route('/generate_pdf', methods=['POST'])
def generate_pdf():
    try:
        data = request.json
        customer_name = data['customer_name']
        customer_id = data['customer_id']
        bill_no = data['bill_no']
        items = data['items']
        subtotal = data['subtotal']
        discount_total = data['discount_total']
        grand_total = data['grand_total']
        theme_color = data.get('theme_color', '#FF4757')

        store = excel_manager.get_store_settings()
        currency = store.get('currency_symbol', '₹')
        store_name = store.get('store_name', 'My Store')
        store_tagline = store.get('store_tagline', '')
        store_address = store.get('store_address', '')
        store_phone = store.get('store_phone', '')
        store_email = store.get('store_email', '')
        store_website = store.get('store_website', '')

        filename = f"Bill_{bill_no}.pdf"
        filepath = os.path.join('static', 'bills', filename)

        doc = SimpleDocTemplate(filepath, pagesize=A4,
                                rightMargin=1.5*cm, leftMargin=1.5*cm,
                                topMargin=1.5*cm, bottomMargin=1.5*cm)
        story = []
        styles = getSampleStyleSheet()

        # Store Header
        story.append(Paragraph(store_name.upper(),
            ParagraphStyle(name='CompanyTitle', parent=styles['Heading1'],
                           fontSize=26, textColor=colors.HexColor(theme_color),
                           alignment=TA_CENTER, spaceAfter=4)))
        if store_tagline:
            story.append(Paragraph(store_tagline,
                ParagraphStyle(name='Tagline', parent=styles['Normal'],
                               fontSize=11, textColor=colors.grey,
                               alignment=TA_CENTER, spaceAfter=4)))
        contact_parts = []
        if store_address:
            contact_parts.append(store_address)
        if store_phone:
            contact_parts.append(store_phone)
        if store_email:
            contact_parts.append(store_email)
        if store_website:
            contact_parts.append(store_website)
        if contact_parts:
            story.append(Paragraph(" | ".join(contact_parts),
                ParagraphStyle(name='Contact', parent=styles['Normal'],
                               fontSize=8, textColor=colors.grey,
                               alignment=TA_CENTER, spaceAfter=12)))

        # Divider line via a thin table
        story.append(Table([['']],
            colWidths=[doc.width],
            style=TableStyle([
                ('LINEABOVE', (0, 0), (-1, 0), 1, colors.HexColor(theme_color)),
                ('TOPPADDING', (0, 0), (-1, -1), 0),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
            ])))
        story.append(Spacer(1, 10))

        title_style = ParagraphStyle(name='InvoiceTitle', parent=styles['Heading2'],
                                     fontSize=16, textColor=colors.HexColor(theme_color),
                                     alignment=TA_CENTER)
        story.append(Paragraph("INVOICE", title_style))
        story.append(Spacer(1, 10))

        # Bill Info Table
        bill_info = [
            [Paragraph(f"<b>Bill No:</b> {bill_no}", styles['Normal']),
             Paragraph(f"<b>Date:</b> {datetime.now().strftime('%d-%m-%Y')}", styles['Normal'])],
            [Paragraph(f"<b>Customer:</b> {customer_name}", styles['Normal']),
             Paragraph(f"<b>Customer ID:</b> {customer_id}", styles['Normal'])]
        ]
        tbl_info = Table(bill_info, colWidths=[doc.width / 2, doc.width / 2])
        tbl_info.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('PADDING', (0, 0), (-1, -1), 6),
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8F9FA')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ]))
        story.append(tbl_info)
        story.append(Spacer(1, 15))

        # Items Table
        data_items = [['#', 'Item Description', f'Price ({currency})', 'Qty', 'Disc %', f'Total ({currency})']]
        for idx, it in enumerate(items, 1):
            data_items.append([
                str(idx),
                it['name'],
                f"{it['price']:.2f}",
                str(it['quantity']),
                f"{it['discount']:.1f}%" if it['discount'] > 0 else '-',
                f"{it['total']:.2f}"
            ])

        col_widths_items = [1*cm, 7*cm, 3*cm, 1.5*cm, 2*cm, 3*cm]
        tbl_items = Table(data_items, colWidths=col_widths_items)
        tbl_items.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(theme_color)),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
            ('TOPPADDING', (0, 0), (-1, 0), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('ALIGN', (2, 1), (-1, -1), 'RIGHT'),
            ('ALIGN', (3, 1), (3, -1), 'CENTER'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F5F5F5')]),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('TOPPADDING', (0, 1), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 5),
        ]))
        story.append(tbl_items)
        story.append(Spacer(1, 15))

        # Summary Table (no tax)
        summary_data = [
            [Paragraph('<b>Subtotal:</b>', styles['Normal']),
             Paragraph(f'{currency}{subtotal:.2f}', styles['Normal'])],
        ]
        if discount_total > 0:
            summary_data.append([
                Paragraph('<b>Discount:</b>', styles['Normal']),
                Paragraph(f'- {currency}{discount_total:.2f}', styles['Normal'])
            ])
        summary_data.append([
            Paragraph(f'<b>GRAND TOTAL:</b>', ParagraphStyle(name='gt', parent=styles['Normal'],
                      fontSize=12, textColor=colors.HexColor(theme_color))),
            Paragraph(f'{currency}{grand_total:.2f}', ParagraphStyle(name='gtv', parent=styles['Normal'],
                      fontSize=12, fontName='Helvetica-Bold', textColor=colors.HexColor(theme_color)))
        ])

        tbl_summary = Table(summary_data, colWidths=[11*cm, 5.5*cm],
                            hAlign='RIGHT')
        summary_style = [
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('PADDING', (0, 0), (-1, -1), 6),
            ('LINEABOVE', (0, -1), (1, -1), 1.5, colors.HexColor(theme_color)),
            ('BACKGROUND', (0, -1), (1, -1), colors.HexColor(theme_color + '15')),
        ]
        if discount_total > 0:
            summary_style.append(('TEXTCOLOR', (1, 1), (1, 1), colors.red))
        tbl_summary.setStyle(TableStyle(summary_style))
        story.append(tbl_summary)

        # QR Code
        qr_filename = generate_qr_code(bill_no, {
            'bill_no': bill_no,
            'store': store_name,
            'customer': customer_name,
            'total': grand_total,
            'date': datetime.now().strftime('%d-%m-%Y')
        })
        qr_path = os.path.join('static', 'qr_codes', qr_filename)
        if os.path.exists(qr_path):
            story.append(Spacer(1, 20))
            qr_table = Table(
                [[Image(qr_path, width=2.5*cm, height=2.5*cm),
                  Paragraph("Scan for digital receipt<br/>Thank you for your business!", 
                            ParagraphStyle(name='QRtext', parent=styles['Normal'],
                                          fontSize=9, textColor=colors.grey))]],
                colWidths=[3*cm, doc.width - 3*cm]
            )
            qr_table.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'MIDDLE')]))
            story.append(qr_table)

        # Footer
        story.append(Spacer(1, 20))
        story.append(Table([['']],
            colWidths=[doc.width],
            style=TableStyle([
                ('LINEABOVE', (0, 0), (-1, 0), 0.5, colors.lightgrey),
                ('TOPPADDING', (0, 0), (-1, -1), 0),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
            ])))
        story.append(Spacer(1, 8))
        story.append(Paragraph(f"Thank you for shopping at {store_name}!",
            ParagraphStyle(name='Footer', parent=styles['Normal'],
                           fontSize=10, alignment=TA_CENTER,
                           textColor=colors.HexColor(theme_color))))

        doc.build(story)

        # Save to Excel
        excel_manager.save_bill_data(
            customer_name=customer_name,
            customer_id=customer_id,
            bill_no=bill_no,
            items=items,
            subtotal=subtotal,
            discount_total=discount_total,
            grand_total=grand_total,
            qr_file=qr_filename,
            pdf_file=filename
        )

        return jsonify({
            'success': True,
            'filename': filename,
            'filepath': f'/static/bills/{filename}',
            'qr_file': qr_filename,
            'qr_path': f'/static/qr_codes/{qr_filename}'
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/get_recent_bills')
def get_recent_bills():
    limit = request.args.get('limit', 5, type=int)
    bills = excel_manager.get_recent_bills(limit)
    return jsonify({'success': True, 'bills': bills})

@app.route('/get_all_bills')
def get_all_bills():
    bills = excel_manager.get_all_bills()
    return jsonify({'success': True, 'bills': bills})

@app.route('/get_summary')
def get_summary():
    summary = excel_manager.generate_summary_report()
    return jsonify({'success': True, 'summary': summary})

@app.route('/export_excel')
def export_excel():
    try:
        return send_file(
            excel_manager.get_excel_file(),
            as_attachment=True,
            download_name=f"Store_Bills_{datetime.now().strftime('%Y%m%d')}.xlsx",
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/erase_all_bills', methods=['POST'])
def erase_all_bills():
    try:
        success = excel_manager.erase_all_bills()
        return jsonify({'success': success})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/factory_reset', methods=['POST'])
def factory_reset():
    try:
        success = excel_manager.factory_reset()
        return jsonify({'success': success})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/static/bills/<filename>')
def serve_bill(filename):
    return send_from_directory('static/bills', filename)

@app.route('/static/qr_codes/<filename>')
def serve_qr(filename):
    return send_from_directory('static/qr_codes', filename)

if __name__ == '__main__':
<<<<<<< HEAD
    import os
    port = int(os.environ.get('PORT', 5004))
    app.run(host='0.0.0.0', port=port, debug=False)
=======
    app.run(debug=True, port=5004)
>>>>>>> ebace947f8595540f54b4a5166aac77498beb749
