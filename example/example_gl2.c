//
// Copyright (c) 2013 Mikko Mononen memon@inside.org
//
// This software is provided 'as-is', without any express or implied
// warranty.  In no event will the authors be held liable for any damages
// arising from the use of this software.
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
// 1. The origin of this software must not be misrepresented; you must not
//    claim that you wrote the original software. If you use this software
//    in a product, an acknowledgment in the product documentation would be
//    appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//    misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.
//

#include <stdio.h>
#include "platform.h"
#include <GLFW/glfw3.h>
#include "nanovg.h"
#define NANOVG_GL3_IMPLEMENTATION
#include "nanovg_gl.h"
#include "nanovg_gl_utils.h"
#define NANOVG_SW_IMPLEMENTATION
#include "nanovg_sw.h"
#include "nanovg_sw_utils.h"
#include "demo.h"
#include "perf.h"

void errorcb(int error, const char *desc)
{
	printf("GLFW error %d: %s\n", error, desc);
}

int blowup = 0;
int screenshot = 0;
int premult = 1;

static void key(GLFWwindow *window, int key, int scancode, int action, int mods)
{
	NVG_NOTUSED(scancode);
	NVG_NOTUSED(mods);
	if (key == GLFW_KEY_ESCAPE && action == GLFW_PRESS)
		glfwSetWindowShouldClose(window, GL_TRUE);
	if (key == GLFW_KEY_SPACE && action == GLFW_PRESS)
		blowup = !blowup;
	if (key == GLFW_KEY_S && action == GLFW_PRESS)
		screenshot = 1;
	if (key == GLFW_KEY_P && action == GLFW_PRESS)
		premult = !premult;
}

void draw_hand(NVGcontext *vg, float theta, float len, float width, int winWidth, int winHeight)
{
	nvgResetTransform(vg);
	nvgTranslate(vg, winWidth / 2.0, winHeight / 2.0);
	nvgBeginPath(vg);
	nvgRotate(vg, theta);
	nvgMoveTo(vg, 0.0, 0.0);
	nvgLineTo(vg, 0.0, -len);
	nvgStrokeWidth(vg, width);
	nvgStrokeColor(vg, nvgRGBf(1.0, 1.0, 1.0));
	nvgStroke(vg);
}

int main()
{
	GLFWwindow *window;
	NVGcontext *vg = NULL;
	double prevt = 0;
	DemoData data;
	PerfGraph fps, cpuGraph, gpuGraph;

	if (!glfwInit())
	{
		printf("Failed to init GLFW.");
		return -1;
	}

	glfwSetErrorCallback(errorcb);

	glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
	glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
	glfwWindowHint(GLFW_OPENGL_FORWARD_COMPAT, GL_TRUE);
	glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);

	window = glfwCreateWindow(1024, 768, "NanoVG", NULL, NULL);
	//	window = glfwCreateWindow(1000, 600, "NanoVG", glfwGetPrimaryMonitor(), NULL);
	if (!window)
	{
		glfwTerminate();
		return -1;
	}

	glfwSetKeyCallback(window, key);

	glfwMakeContextCurrent(window);
	gladLoadGLLoader((GLADloadproc)glfwGetProcAddress);
	vg = nvglCreate(NVG_SRGB);

	if (vg == NULL)
	{
		printf("Could not init nanovg.\n");
		return -1;
	}

	if (loadDemoData(vg, &data, NVG_IMAGE_SRGB) == -1)
		return -1;

	// glfwSwapInterval(1);

	glfwSetTime(0);
	prevt = glfwGetTime();

	float theta = 0.0f;

	while (!glfwWindowShouldClose(window))
	{
		double mx, my, t, dt;
		int winWidth, winHeight;
		int fbWidth, fbHeight;
		float pxRatio;

		t = glfwGetTime();
		dt = t - prevt;
		prevt = t;
		updateGraph(&fps, dt);

		glfwGetCursorPos(window, &mx, &my);
		glfwGetWindowSize(window, &winWidth, &winHeight);
		glfwGetFramebufferSize(window, &fbWidth, &fbHeight);

		// Calculate pixel ration for hi-dpi devices.
		pxRatio = (float)fbWidth / (float)winWidth;

		// Update and render
		glViewport(0, 0, fbWidth, fbHeight);
		// if (premult)
		// 	glClearColor(0, 0, 0, 0);
		// else
		glClearColor(0.2f, 0.2f, 0.2f, 1.0f);
		// glClearColor(0.3f, 0.3f, 0.5f, 1.0f);
		glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT | GL_STENCIL_BUFFER_BIT);
		NVGcolor silver = nvgRGB(196, 199, 206);
		NVGcolor dailColor = nvgRGBf(0.3, 0.2, 0.6);
		if (1)
		{
			nvgBeginFrame(vg, winWidth, winHeight, pxRatio);
			// renderDemo(vg, mx,my, winWidth,winHeight, t, blowup, &data);
			nvgSave(vg);
			nvgRotate(vg, NVG_PI / 6);
			nvgBeginPath(vg);
			nvgMoveTo(vg, 200.0, 200.0);
			nvgLineTo(vg, 600.0, 200.0);
			nvgLineTo(vg, 400.0, 100.0);
			nvgLineTo(vg, 400.0, 600.0);
			nvgClosePath(vg);
			nvgRestore(vg);
			// nvgFillColor(vg, nvgRGBAf(0.2, 0.6, 0.2, 0.7));
			nvgCircle(vg, 700.0, 500.0, 500.0);
			// nvgFill(vg);
			nvgStrokeColor(vg, nvgRGBA(0xff, 0xff, 0xff, 0xff));
			nvgStrokeWidth(vg, 4);
			nvgStroke(vg);

			nvgEndFrame(vg);
			nvgBeginFrame(vg, winWidth, winHeight, 1.0f);
			nvgBeginPath(vg);
			nvgCircle(vg, 250, 220, 50);
			// nvgCircle(vg, 250, 120, 50);
			nvgRect(vg, 0, 0, mx, my);
			nvgPathWinding(vg, NVG_HOLE);
			nvgFillColor(vg, nvgRGBA(255, 192, 0, 255));
			nvgFill(vg);
			renderGraph(vg, 5, 5, &fps);
			nvgEndFrame(vg);
		}
		else
		{
			nvgBeginFrame(vg, winWidth, winHeight, pxRatio);
			float clock_size = fmin(winWidth, winHeight);
			nvgBeginPath(vg);
			nvgTranslate(vg, winWidth / 2.0, winHeight / 2.0);
			nvgCircle(vg, 0.0, 0.0, (clock_size - 2.0) / 2.0);
			nvgStrokeWidth(vg, 3.0);
			nvgStrokeColor(vg, silver);
			nvgFillColor(vg, dailColor);
			nvgFill(vg);
			nvgStroke(vg);

			draw_hand(vg, theta, clock_size / 2 * 0.9, 1.0, winWidth, winHeight);
			draw_hand(vg, theta / 60, clock_size / 2 * 0.8, 3.0, winWidth, winHeight);
			draw_hand(vg, theta / 3600, clock_size / 2 * 0.6, 5.0, winWidth, winHeight);

			nvgEndFrame(vg);
			theta += 0.01f;
		}

		if (screenshot)
		{
			screenshot = 0;
			saveScreenShot(fbWidth, fbHeight, premult, "dump.png");
		}

		glfwSwapBuffers(window);
		glfwPollEvents();
	}

	freeDemoData(vg, &data);

	nvglDelete(vg);

	glfwTerminate();
	return 0;
}
