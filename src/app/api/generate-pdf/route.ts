import { NextRequest, NextResponse } from 'next/server';
import * as path from 'path';
import * as fs from 'fs';

// We need to use require for html-pdf as it doesn't support ES modules
const pdf = require('html-pdf');

export async function POST(request: NextRequest) {
  try {
    const { html } = await request.json();

    if (!html) {
      return NextResponse.json(
        { error: 'HTML content is required' },
        { status: 400 }
      );
    }

    console.log('Received HTML for PDF generation');

    // Check if PhantomJS path exists in node_modules
    const phantomPath = path.join(process.cwd(), 'node_modules', 'phantomjs-prebuilt', 'bin', 'phantomjs');
    const phantomExists = fs.existsSync(phantomPath);
    console.log(`PhantomJS path: ${phantomPath}, exists: ${phantomExists}`);

    // PDF generation options
    const options = { 
      format: 'Letter',
      orientation: 'portrait',
      border: {
        top: '1cm',
        right: '1cm',
        bottom: '1cm',
        left: '1cm'
      },
      // Specify PhantomJS path if available
      phantomPath: phantomExists ? phantomPath : undefined,
      timeout: 30000 // Increase timeout
    };

    console.log('Starting PDF generation with options:', JSON.stringify(options));

    // Generate PDF buffer
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      pdf.create(html, options).toBuffer((err: Error, buffer: Buffer) => {
        if (err) {
          console.error('Error generating PDF:', err);
          console.error('Error details:', JSON.stringify(err, null, 2));
          reject(err);
        } else {
          console.log('PDF generated successfully');
          resolve(buffer);
        }
      });
    });

    console.log('PDF buffer size:', buffer.length);

    // Return the PDF buffer directly
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="SOAP_Note.pdf"',
      },
    });

  } catch (error) {
    console.error('Error in PDF generation:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return NextResponse.json(
      { error: 'Failed to generate PDF', details: String(error) },
      { status: 500 }
    );
  }
} 