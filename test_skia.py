import contextlib, glfw, skia
from OpenGL import GL
import math

WIDTH, HEIGHT = 640, 480

@contextlib.contextmanager
def glfw_window():
    if not glfw.init():
        raise RuntimeError('glfw.init() failed')
    glfw.window_hint(glfw.STENCIL_BITS, 8)
    window = glfw.create_window(WIDTH, HEIGHT, '', None, None)
    glfw.make_context_current(window)
    window.vsync = 1
    yield window
    glfw.terminate()

@contextlib.contextmanager
def skia_surface(window):
    context = skia.GrDirectContext.MakeGL()
    (fb_width, fb_height) = glfw.get_framebuffer_size(window)
    backend_render_target = skia.GrBackendRenderTarget(
        fb_width,
        fb_height,
        0,  # sampleCnt
        8,  # stencilBits
        skia.GrGLFramebufferInfo(0, GL.GL_RGBA8))
    surface = skia.Surface.MakeFromBackendRenderTarget(
        context, backend_render_target, skia.kBottomLeft_GrSurfaceOrigin,
        skia.kRGBA_8888_ColorType, skia.ColorSpace.MakeSRGB())
    assert surface is not None
    yield surface
    context.abandonContext()

def draw(canvas):
    canvas.save()
    canvas.drawCircle(100, 100, 40, skia.Paint(Color=skia.Color(240, 140, 50), AntiAlias=True))
    paint = skia.Paint(AntiAlias=True, StrokeWidth=3)
    path = skia.Path()
    path.moveTo(200, 200)
    path.lineTo(300, 100)
    # path.lineTo(400, 100)
    path.lineTo(500, 400)
    path.close()
    path.addCircle(200,200,100)
    paint.setStyle(skia.Paint.kFill_Style)
    # paint.setStyle(skia.Paint.kStroke_Style)
    paint.setColor(skia.ColorWHITE)
    # canvas.rotate(30)
    canvas.drawPath(path, paint)
    canvas.restore()


with glfw_window() as window:
    with skia_surface(window) as surface:
        while (glfw.get_key(window, glfw.KEY_ESCAPE) != glfw.PRESS
            and not glfw.window_should_close(window)):
            glfw.wait_events()
            with surface as canvas:
                GL.glClearColor(0.3, 0.3, 0.3, 1.0)
                GL.glClear(GL.GL_COLOR_BUFFER_BIT)
                draw(canvas)
            surface.flushAndSubmit()
            glfw.swap_buffers(window)