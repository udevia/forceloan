import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Order, Customer } from '../db/db';

export const generateOrderPDF = async (order: Order, customer?: Customer): Promise<File> => {
  const doc = new jsPDF();
  
  // Encabezado principal
  doc.setFontSize(20);
  doc.setTextColor(1, 63, 184); // Azul Inversiones Loan
  doc.text('Inversiones Loan', 14, 22);
  
  // Subtítulo
  doc.setFontSize(14);
  doc.setTextColor(100, 100, 100);
  doc.text('Comprobante de Pedido', 14, 30);
  
  // Datos del Cliente y Fechas
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  
  const dateStr = new Date(order.created_at || Date.now()).toLocaleString();
  const orderId = order.id || order.backend_id || 'PENDIENTE';
  
  doc.text(`Nº Pedido: ${orderId}`, 14, 45);
  doc.text(`Fecha: ${dateStr}`, 14, 52);
  
  const tipoCondicion = order.is_credit ? 'Realizar pago al llegar despacho' : 'Contado';
  doc.text(`Condición: ${tipoCondicion}`, 14, 59);

  if (customer) {
    doc.text(`Cliente: ${customer.name}`, 120, 45);
    if (customer.dni) doc.text(`Doc: ${customer.dniType}-${customer.dni}`, 120, 52);
    if (customer.phone) doc.text(`Teléfono: ${customer.phone}`, 120, 59);
  }

  // Preparar datos de la tabla
  const tableBody = order.items.map(item => [
    item.name,
    item.quantity.toString(),
    `$${item.price.toFixed(2)}`,
    `$${(item.quantity * item.price).toFixed(2)}`
  ]);

  // Dibujar tabla
  autoTable(doc, {
    startY: 70,
    head: [['Producto', 'Cant.', 'Precio Unit.', 'Subtotal']],
    body: tableBody,
    theme: 'striped',
    headStyles: { fillColor: [1, 63, 184] },
    margin: { top: 70 }
  });

  // Totales
  const finalY = (doc as any).lastAutoTable.finalY || 70;
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total USD: $${order.total.toFixed(2)}`, 14, finalY + 15);
  
  if (order.totalBs) {
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`Total Bs (Ref): Bs ${order.totalBs.toFixed(2)}`, 14, finalY + 22);
  }

  // Notas finales
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120, 120, 120);
  
  const nota1 = 'Pagos en Bs calculados a la tasa Dólar BCV del día del despacho.';
  const nota2 = 'Nota administrativa: Una vez llega el despacho a la puerta del cliente, este debe realizar el pago para poder recibir la mercancía. Sin pago validado, el despachador no procederá a la entrega. Agradecemos su comprensión.';

  doc.text(nota1, 14, finalY + 35);
  
  // Dividir texto largo en varias líneas para que no se corte
  const splitNota2 = doc.splitTextToSize(nota2, 180);
  doc.text(splitNota2, 14, finalY + 42);

  // Pie de página
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150, 150, 150);
  doc.text('¡Gracias por su compra!', 105, finalY + 65, { align: 'center' });

  // Generar Blob y File
  const pdfBlob = doc.output('blob');
  
  // Limpiar nombre del archivo
  const safeCustomerName = customer?.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'cliente';
  const fileName = `pedido_${safeCustomerName}_${dateStr.split(',')[0].replace(/\//g, '-')}.pdf`;
  
  return new File([pdfBlob], fileName, { type: 'application/pdf' });
};
