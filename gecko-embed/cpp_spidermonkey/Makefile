CXX      := g++
CXXFLAGS := -std=c++20 -O2 -Wall -Wno-dangling-pointer $(shell pkg-config --cflags mozjs-128)
LDFLAGS  := $(shell pkg-config --libs mozjs-128)
TARGET   := bin/embed_gecko_js

.PHONY: all run clean

all: $(TARGET)

$(TARGET): embed_gecko_js.cpp
	mkdir -p bin
	$(CXX) $(CXXFLAGS) -o $(TARGET) embed_gecko_js.cpp $(LDFLAGS)

run: $(TARGET)
	./$(TARGET)

clean:
	rm -rf bin
