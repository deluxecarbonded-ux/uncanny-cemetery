CXX      := x86_64-w64-mingw32-g++
WINDRES  := x86_64-w64-mingw32-windres
STRIP    := x86_64-w64-mingw32-strip
CXXFLAGS := -std=c++20 -O2 -Wall -Wextra -Wno-missing-field-initializers -municode -mwindows
LDFLAGS  := -static -static-libgcc -static-libstdc++ -mwindows -municode -lshell32 -lole32 -ladvapi32 -luuid
BIN_DIR  := ../../bin
TARGET   := $(BIN_DIR)/Exotic.exe
RES_OBJ  := exotic_res.o

.PHONY: all clean

all: $(TARGET)

$(RES_OBJ): exotic.rc exotic.manifest ../../assets/exotic.ico
	$(WINDRES) exotic.rc -O coff -o $(RES_OBJ)

$(TARGET): exotic_launcher.cpp $(RES_OBJ)
	mkdir -p $(BIN_DIR)
	$(CXX) $(CXXFLAGS) -o $(TARGET) exotic_launcher.cpp $(RES_OBJ) $(LDFLAGS)
	$(STRIP) -s $(TARGET)
	rm -f $(RES_OBJ)

clean:
	rm -f $(RES_OBJ) $(TARGET)
