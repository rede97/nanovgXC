#ifdef USE_FRAMEBUFFER_FETCH
// #extension must come before any other statements, including precision
#extension GL_EXT_shader_framebuffer_fetch : require
#elif defined(USE_IMAGE_LOADSTORE)
#ifdef GL_ES
#extension GL_OES_shader_image_atomic : require
#else
#extension GL_ARB_shader_image_load_store : require
#endif
#endif

#ifdef GL_ES
#if defined(GL_FRAGMENT_PRECISION_HIGH) || defined(NANOVG_GL3)
precision highp float;
precision highp int;
precision highp sampler2D;
#else
precision mediump float;
#endif
#endif

#ifdef NANOVG_GL3
#define texture2D texture
#define varying in
#endif

// these must match NVGpathFlags
#define NVG_PATH_EVENODD 0x1
#define NVG_PATH_NO_AA 0x2
#define NVG_PATH_CONVEX 0x4

#ifdef USE_FRAMEBUFFER_FETCH
layout (location = 0) inout vec4 outColor;
layout (location = 1) inout int inoutWinding;
#elif defined(NANOVG_GL3)
layout (location = 0) out vec4 outColor;
#else
#define outColor gl_FragData[0]
#endif

#define WINDING_SCALE 65536.0
#ifdef USE_IMAGE_LOADSTORE
#ifdef GL_ES
layout(binding = 0, r32i) coherent uniform highp iimage2D windingImg;
#else
layout(r32i) coherent uniform highp iimage2D windingImg;  // binding = 0 ... GLES 3.1 or GL 4.2+ only
#endif
uniform ivec4 imgParams;
#define imgOffset imgParams.x
#define imgQuadStride imgParams.y
#define imgStride imgParams.z
#define disableAA (imgParams.w != 0)
#elif !defined(USE_FRAMEBUFFER_FETCH)
uniform sampler2D windingTex;
#endif

#ifdef USE_UNIFORMBUFFER
layout(std140) uniform frag {
    mat3 scissorMat;
    mat3 paintMat;
    vec4 innerCol;
    vec4 outerCol;
    vec2 scissorExt;
    vec2 scissorScale;
    vec2 extent;
    float radius;
    float feather;
    float strokeMult;
    float strokeThr;
    int texType;
    int fillMode;
};
#else
uniform vec4 frag[UNIFORMARRAY_SIZE];
#define scissorMat mat3(frag[0].xyz, frag[1].xyz, frag[2].xyz)
#define paintMat mat3(frag[3].xyz, frag[4].xyz, frag[5].xyz)
#define innerCol frag[6]
#define outerCol frag[7]
#define scissorExt frag[8].xy
#define scissorScale frag[8].zw
#define extent frag[9].xy
#define radius frag[9].z
#define feather frag[9].w
#define strokeMult frag[10].x
#define strokeThr frag[10].y
#define texType int(frag[10].z)
#define fillMode int(frag[10].w)
#endif
#ifndef USE_IMAGE_LOADSTORE
#define disableAA ((fillMode & NVG_PATH_NO_AA) != 0)
#endif
uniform sampler2D tex;
uniform vec2 viewSize;
uniform int type;

varying vec2 va;
varying vec2 vb;
//#define fpos va
#define ftcoord vb

float coversCenter(vec2 v0, vec2 v1)
{
// no AA - just determine if center of pixel (0,0) is inside trapezoid
if(v1.x <= 0.0f || v0.x > 0.0f || v0.x == v1.x)
    return 0.0f;
return v0.y*(v1.x - v0.x) - v0.x*(v1.y - v0.y) > 0.0f ? 1.0f : 0.0f;
}

// unlike areaEdge(), this assumes pixel center is (0,0), not (0.5, 0.5)
float areaEdge2(vec2 v0, vec2 v1)
{
if(disableAA)
    return v1.x < v0.x ? coversCenter(v1, v0) : -coversCenter(v0, v1);
vec2 window = clamp(vec2(v0.x, v1.x), -0.5f, 0.5f);
float width = window.y - window.x;
//if(v0.y > 0.5f && v1.y > 0.5f)  -- didn't see a significant effect on Windows
//  return -width;
vec2 dv = v1 - v0;
float slope = dv.y/dv.x;
float midx = 0.5f*(window.x + window.y);
float y = v0.y + (midx - v0.x)*slope;  // y value at middle of window
float dy = abs(slope*width);
// credit for this to https://git.sr.ht/~eliasnaur/gio/tree/master/gpu/shaders/stencil.frag
// if width == 1 (so midx == 0), the components of sides are: y crossing of right edge of frag, y crossing
//  of left edge, x crossing of top edge, x crossing of bottom edge.  Since we only consider positive slope
//  (note abs() above), there are five cases (below, bottom-right, left-right, left-top, above) - the area
//  formula below reduces to these cases thanks to the clamping of the other values to 0 or 1.
// I haven't thought carefully about the width < 1 case, but experimentally it matches areaEdge()
vec4 sides = vec4(y + 0.5f*dy, y - 0.5f*dy, (0.5f - y)/dy, (-0.5f - y)/dy);  //ry, ly, tx, bx
sides = clamp(sides + 0.5f, 0.0f, 1.0f);  // shift from -0.5..0.5 to 0..1 for area calc
float area = 0.5f*(sides.z - sides.z*sides.y - 1.0f - sides.x + sides.x*sides.w);
return width == 0.0f ? 0.0f : area * width;
}

#ifdef USE_IMAGE_LOADSTORE
// imageBuffer image type allows for 1D buffer, but max size may be very small on some GPUs
ivec2 imgCoords()
{
int idx = imgOffset + int(gl_FragCoord.x) + int(gl_FragCoord.y)*imgQuadStride;
int y = idx/imgStride;
return ivec2(idx - y*imgStride, y);
}
#endif

float coverage()
{
if((fillMode & NVG_PATH_CONVEX) != 0)
    return 1.0f;
#ifdef USE_FRAMEBUFFER_FETCH
float W = float(inoutWinding)/WINDING_SCALE;
#elif defined(USE_IMAGE_LOADSTORE)
float W = float(imageAtomicExchange(windingImg, imgCoords(), 0))/WINDING_SCALE;
#else
float W = texelFetch(windingTex, ivec2(gl_FragCoord.xy), 0).r;
//float W = texture2D(windingTex, gl_FragCoord.xy/viewSize).r;  // note .r (first) component
#endif
// even-odd fill if bit 0 set, otherwise winding fill
return ((fillMode & NVG_PATH_EVENODD) == 0) ? min(abs(W), 1.0f) : (1.0f - abs(mod(W, 2.0f) - 1.0f));
// previous incorrect calculation for no AA case wrapped these in round(x) := floor(x + 0.5f)
}

float sdroundrect(vec2 pt, vec2 ext, float rad)
{
vec2 ext2 = ext - vec2(rad,rad);
vec2 d = abs(pt) - ext2;
return min(max(d.x,d.y),0.0) + length(max(d,0.0)) - rad;
}

// Scissoring
float scissorMask(vec2 p)
{
vec2 sc = (abs((scissorMat * vec3(p,1.0)).xy) - scissorExt);
sc = vec2(0.5,0.5) - sc * scissorScale;
return clamp(sc.x,0.0,1.0) * clamp(sc.y,0.0,1.0);
}

#ifdef USE_SDF_TEXT
// Super-sampled SDF text rendering - super-sampling gives big improvement at very small sizes; quality is
//  comparable to summed text; w/ supersamping, FPS is actually slightly lower
float sdfCov(float D, float sdfscale)
{
// Could we use derivative info (and/or distance at pixel center) to improve?
return D > 0.0f ? clamp((D - 0.5f)/sdfscale + radius, 0.0f, 1.0f) : 0.0f;  //+ 0.25f
}

float superSDF(sampler2D tex, vec2 st)
{
vec2 tex_wh = vec2(textureSize(tex, 0));  // convert from ivec2 to vec2
//st = st + vec2(4.0)/tex_wh;  // account for 4 pixel padding in SDF
float s = (32.0f/255.0f)*paintMat[0][0];  // 32/255 is STBTT pixel_dist_scale
//return sdfCov(texture2D(tex, st).r, s);  // single sample
s = 0.5f*s;  // we're sampling 4 0.5x0.5 subpixels
float dx = paintMat[0][0]/tex_wh.x/4.0f;
float dy = paintMat[1][1]/tex_wh.y/4.0f;

//vec2 stextent = extent/tex_wh;  ... clamping doesn't seem to be necessary
//vec2 stmin = floor(st*stextent)*stextent;
//vec2 stmax = stmin + stextent - vec2(1.0f);
float d11 = texture2D(tex, st + vec2(dx, dy)).r;  // clamp(st + ..., stmin, stmax)
float d10 = texture2D(tex, st + vec2(dx,-dy)).r;
float d01 = texture2D(tex, st + vec2(-dx, dy)).r;
float d00 = texture2D(tex, st + vec2(-dx,-dy)).r;
return 0.25f*(sdfCov(d11, s) + sdfCov(d10, s) + sdfCov(d01, s) + sdfCov(d00, s));
}
#else
// artifacts w/ GL_LINEAR on Intel GPU and GLES doesn't support texture filtering for f32, so do it ourselves
// also, min/mag filter must be set to GL_NEAREST for float texture or texelFetch() will fail on Mali GPUs
float texFetchLerp(sampler2D texture, vec2 ij, vec2 ijmin, vec2 ijmax)
{
vec2 ij00 = clamp(ij, ijmin, ijmax);
vec2 ij11 = clamp(ij + vec2(1.0f), ijmin, ijmax);
float t00 = texelFetch(texture, ivec2(ij00.x, ij00.y), 0).r;  // implicit floor()
float t10 = texelFetch(texture, ivec2(ij11.x, ij00.y), 0).r;
float t01 = texelFetch(texture, ivec2(ij00.x, ij11.y), 0).r;
float t11 = texelFetch(texture, ivec2(ij11.x, ij11.y), 0).r;
vec2 f = ij - floor(ij);
//return mix(mix(t00, t10, f.x), mix(t01, t11, f.x), f.y);
float t0 = t00 + f.x*(t10 - t00);
float t1 = t01 + f.x*(t11 - t01);
return t0 + f.y*(t1 - t0);
}

float summedTextCov(sampler2D texture, vec2 st)
{
ivec2 tex_wh = textureSize(texture, 0);
vec2 ij = st*vec2(tex_wh);  // - vec2(1.0f)  -- now done after finding ijmin,max
vec2 ijmin = floor(ij/extent)*extent;
vec2 ijmax = ijmin + extent - vec2(1.0f);
// for some reason, we need to shift by an extra (-0.5, -0.5) for summed case (here or in fons__getQuad)
ij -= vec2(0.999999f);
float dx = paintMat[0][0]/2.0f;
float dy = paintMat[1][1]/2.0f;
float s11 = texFetchLerp(texture, ij + vec2(dx, dy), ijmin, ijmax);
float s01 = texFetchLerp(texture, ij + vec2(-dx, dy), ijmin, ijmax);
float s10 = texFetchLerp(texture, ij + vec2(dx,-dy), ijmin, ijmax);
float s00 = texFetchLerp(texture, ij + vec2(-dx,-dy), ijmin, ijmax);
float cov = (s11 - s01 - s10 + s00)/(255.0f*4.0f*dx*dy);
return clamp(cov, 0.0f, 1.0f);
}
#endif

void main(void)
{
vec4 result;
vec2 fpos = vec2(gl_FragCoord.x, viewSize.y - gl_FragCoord.y);
int winding = 0;
if (type == 0) {  // clear winding number (not used in USE_FRAMEBUFFER_FETCH case)
    result = vec4(0.0f);
} else if (type == 1) {  // calculate winding
    float W = areaEdge2(vb - fpos, va - fpos);
#ifdef USE_FRAMEBUFFER_FETCH
    result = vec4(0.0f);
    winding = int(W*WINDING_SCALE) + inoutWinding;
#elif defined(USE_IMAGE_LOADSTORE)
    result = vec4(0.0f);
    imageAtomicAdd(windingImg, imgCoords(), int(W*WINDING_SCALE));
    //discard;  -- doesn't seem to affect performance
#else
    result = vec4(W);
#endif
} else if (type == 2) {  // Solid color
    result = innerCol*(scissorMask(fpos)*coverage());
} else if (type == 3) {  // Gradient
    // Calculate gradient color using box gradient
    vec2 pt = (paintMat * vec3(fpos,1.0)).xy;
    float d = clamp((sdroundrect(pt, extent, radius) + feather*0.5) / feather, 0.0, 1.0);
    vec4 color = texType > 0 ? texture2D(tex, vec2(d,0)) : mix(innerCol,outerCol,d);
    if (texType == 1) color = vec4(color.rgb*color.a, color.a);
    // Combine alpha
    result = color*(scissorMask(fpos)*coverage());
} else if (type == 4) {  // Image
    // Calculate color from texture
    vec2 pt = (paintMat * vec3(fpos,1.0)).xy / extent;
    vec4 color = texture2D(tex, pt);
    if (texType == 1) color = vec4(color.rgb*color.a, color.a);
    else if (texType == 2) color = vec4(color.r);
    // Apply color tint and alpha.
    color *= innerCol;
    // Combine alpha
    result = color*(scissorMask(fpos)*coverage());
} else if (type == 5) {  // Textured tris - only used for text, so no need for coverage()
#ifdef USE_SDF_TEXT
    float cov = scissorMask(fpos)*superSDF(tex, ftcoord);
#else
    float cov = scissorMask(fpos)*summedTextCov(tex, ftcoord);
#endif
    result = vec4(cov) * innerCol;
    // this is wrong - see alternative outColor calc below for correct text gamma handling
    //result = innerCol*pow(vec4(cov), vec4(1.5,1.5,1.5,0.5));
}
#ifdef USE_FRAMEBUFFER_FETCH
outColor = result + (1.0f - result.a)*outColor;
//outColor.rgb = pow(pow(result.rgb, vec3(1.5/2.2)) + (1.0f - result.a)*pow(outColor.rgb, vec3(1.5/2.2)), vec3(2.2/1.5));
inoutWinding = winding;
#else
outColor = result;
#endif
}
