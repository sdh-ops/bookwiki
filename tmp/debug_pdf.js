try {
    const PDFParse = require('pdf-parse').PDFParse;
    const parser = new PDFParse(); // This might throw if it needs options
    console.log('parser.parse type:', typeof parser.parse);
} catch (e) {
    console.log('Error with new PDFParse().parse:', e.message);
}
