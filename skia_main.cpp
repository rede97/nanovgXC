#include <include/core/SkCanvas.h>
#include <include/core/SkBitmap.h>
#include <include/core/SkPaint.h>
#include <include/core/SkTypeface.h>
#include <include/core/SkFont.h>
#include <include/codec/SkCodec.h>
#include <include/core/SkImageEncoder.h>
#include <include/core/SkStream.h>


int main() {
    SkBitmap bitmap;
    bitmap.allocPixels(SkImageInfo::MakeN32Premul(800, 600));
    SkCanvas canvas(bitmap);
    SkPaint paint;
    paint.setColor(SK_ColorWHITE);
    canvas.drawRect(SkRect::MakeWH(800, 600), paint);


    SkPaint textPaint;
    textPaint.setColor(SK_ColorBLACK);
    textPaint.setAntiAlias(true);
    
    SkFont font;
    font.setTypeface(SkTypeface::MakeFromName("Arial", SkFontStyle()));
    font.setSize(48);
    canvas.drawString("Hello, Skia!", 100, 100, font, textPaint);

    SkFILEWStream fileStream("output.png");
    SkEncodeImage(&fileStream, bitmap, SkEncodedImageFormat::kPNG, 100);
    
    

    return 0;
}