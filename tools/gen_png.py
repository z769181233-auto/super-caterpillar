import struct
import zlib

def png_chunk(chunk_type, data):
    return (struct.pack('>I', len(data)) +
            chunk_type +
            data +
            struct.pack('>I', zlib.crc32(chunk_type + data) & 0xffffffff))

def make_png(width, height):
    # Header
    png = b'\x89PNG\r\n\x1a\n'
    # IHDR
    # Width, Height, BitDepth(8), ColorType(6=RGBA), Compression(0), Filter(0), Interlace(0)
    png += png_chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
    # IDAT
    # RGBA: 255,0,0,255
    raw_data = b''
    for _ in range(height):
        raw_data += b'\x00' # No filter
        raw_data += b'\xff\x00\x00\xff' * width
    
    png += png_chunk(b'IDAT', zlib.compress(raw_data, level=9))
    # IEND
    png += png_chunk(b'IEND', b'')
    return png

p = make_png(2, 2)
print(p.hex())
