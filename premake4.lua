
local action = _ACTION or ""

solution "nanovg"
	location ( "build" )
	configurations { "Debug", "Release" }
	platforms {"native", "x64", "x32"}

	project "example_glfw"
		kind "ConsoleApp"
		language "C"
		files { "src/nanovg.c", "glad/glad.c", "example/example_glfw.c", "example/demo.c", "example/perf.c" }
		includedirs { "src", "example", "example/stb", "glad" }
		targetdir("build")
        defines { "NVGSWU_GL3" }

		configuration { "linux" }
            linkoptions { "`pkg-config --libs glfw3`" }
            links { "GL", "GLU", "m" }
            defines { "NANOVG_GLEW" }

		configuration { "windows" }
			 links { "glfw3", "gdi32", "winmm", "user32", "kernel32" }
			 defines { "NANOVG_GLEW", "_CRT_SECURE_NO_WARNINGS" }

		configuration { "macosx" }
			links { "glfw3" }
			linkoptions { "-framework OpenGL", "-framework Cocoa", "-framework IOKit", "-framework CoreVideo", "-framework Carbon" }

		configuration "Debug"
			defines { "DEBUG" }
			flags { "Symbols", "ExtraWarnings"}

		configuration "Release"
			defines { "NDEBUG" }
			flags { "Optimize", "ExtraWarnings"}

    project "hello_skia"
        kind "ConsoleApp"
        language "C++"
        files { "skia_main.cpp" }
        targetdir("build")

        configuration { "linux" }
            linkoptions { "`pkg-config --libs glfw3`" }

        configuration { "windows" }
            includedirs { "C:/msys64/mingw64/bin/../include/skia" }
            links { "skia" ,"gdi32" ,"opengl32" ,"ole32" ,"oleaut32" ,"uuid" ,"fontsub" ,"user32" ,"usp10" ,"expat" ,"png16" ,"z" ,"webp" ,"webpmux" ,"webpdecoder" ,"webpdemux" ,"jpeg" ,"harfbuzz" ,"icuin" ,"icuuc" ,"icudt" }

