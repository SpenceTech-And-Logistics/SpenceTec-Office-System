// Turns the on-screen invoice into an A4 PDF file and downloads it.
// The PDF libraries are only loaded when someone clicks "Download PDF", so the desk stays fast.
export async function downloadInvoicePdf(el, fileName) {
  if (!el) throw new Error("No invoice on the page");
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);

  // Render a clean copy at a fixed A4-like width, so phones and wide screens give the same PDF.
  const holder = document.createElement("div");
  holder.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;background:#fff;z-index:-1";
  const copy = el.cloneNode(true);
  copy.style.cssText = "width:794px;max-width:none;margin:0;border:0;border-radius:0;box-shadow:none;padding:36px 46px 40px;position:relative";
  holder.appendChild(copy);
  document.body.appendChild(holder);
  try {
    await Promise.all([...copy.querySelectorAll("img")].map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; }))));
    const canvas = await html2canvas(copy, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false, windowWidth: 794 });
    const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
    const pageW = 210, pageH = 297;
    const imgH = (canvas.height * pageW) / canvas.width;
    const img = canvas.toDataURL("image/jpeg", 0.92);
    // Long invoices continue on more pages.
    let y = 0;
    pdf.addImage(img, "JPEG", 0, y, pageW, imgH);
    let left = imgH - pageH;
    while (left > 1) {
      y -= pageH;
      pdf.addPage();
      pdf.addImage(img, "JPEG", 0, y, pageW, imgH);
      left -= pageH;
    }
    pdf.setProperties({ title: fileName.replace(/\.pdf$/, ""), author: "SpenceTec and Logistics" });
    pdf.save(fileName);
  } finally {
    holder.remove();
  }
}

// "INV-006_SpenceTec_Invoice_Betty_Karimi.pdf", like the Word invoices.
export const invoiceFileName = (number, client) =>
  `${number}_SpenceTec_Invoice_${String(client || "Client").normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_")}.pdf`;
