Engine invocation failed: FFmpeg failed (status 69): ffmpeg version 8.0.1 Copyright (c) 2000-2025 the FFmpeg developers
built with Apple clang version 17.0.0 (clang-1700.4.4.1)
configuration: --prefix=/opt/homebrew/Cellar/ffmpeg/8.0.1 --enable-shared --enable-pthreads --enable-version3 --cc=clang --host-cflags= --host-ldflags= --enable-ffplay --enable-gnutls --enable-gpl --enable-libaom --enable-libaribb24 --enable-libbluray --enable-libdav1d --enable-libharfbuzz --enable-libjxl --enable-libmp3lame --enable-libopus --enable-librav1e --enable-librist --enable-librubberband --enable-libsnappy --enable-libsrt --enable-libssh --enable-libsvtav1 --enable-libtesseract --enable-libtheora --enable-libvidstab --enable-libvmaf --enable-libvorbis --enable-libvpx --enable-libwebp --enable-libx264 --enable-libx265 --enable-libxml2 --enable-libxvid --enable-lzma --enable-libfontconfig --enable-libfreetype --enable-frei0r --enable-libass --enable-libopencore-amrnb --enable-libopencore-amrwb --enable-libopenjpeg --enable-libspeex --enable-libsoxr --enable-libzmq --enable-libzimg --disable-libjack --disable-indev=jack --enable-videotoolbox --enable-audiotoolbox --enable-neon
libavutil 60. 8.100 / 60. 8.100
libavcodec 62. 11.100 / 62. 11.100
libavformat 62. 3.100 / 62. 3.100
libavdevice 62. 1.100 / 62. 1.100
libavfilter 11. 4.100 / 11. 4.100
libswscale 9. 1.100 / 9. 1.100
libswresample 6. 1.100 / 6. 1.100
[png @ 0x13af04270] Invalid PNG signature 0x44554D4D5920494D.
Last message repeated 1 times
[image2 @ 0x13b804470] Could not find codec parameters for stream 0 (Video: png, none): unspecified size
Consider increasing the value for the 'analyzeduration' (0) and 'probesize' (5000000) options
Input #0, image2, from '/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/api/apps/workers/.runtime/assets*gate_p0r1/temp_seq_job-p0r4-video-20260114_233649/frame*%04d.png':
Duration: 00:00:00.08, start: 0.000000, bitrate: N/A
Stream #0:0: Video: png, none, 24 fps, 24 tbr, 24 tbn
Stream mapping:
Stream #0:0 -> #0:0 (png (native) -> h264 (libx264))
Press [q] to stop, [?] for help
[png @ 0x13af085f0] Invalid PNG signature 0x44554D4D5920494D.
[png @ 0x13af08b90] Invalid PNG signature 0x44554D4D5920494D.
[vist#0:0/png @ 0x13af04270] [dec:png @ 0x13af06a70] Decoding error: Invalid data found when processing input
Last message repeated 1 times
[vist#0:0/png @ 0x13af04270] [dec:png @ 0x13af06a70] Decode error rate 1 exceeds maximum 0.666667
[vist#0:0/png @ 0x13af04270] [dec:png @ 0x13af06a70] Task finished with error code: -1145393733 (Error number -1145393733 occurred)
[vf#0:0 @ 0x13c009800] Cannot determine format of input 0:0 after EOF
[vf#0:0 @ 0x13c009800] Task finished with error code: -1094995529 (Invalid data found when processing input)
[vf#0:0 @ 0x13c009800] Terminating thread with return code -1094995529 (Invalid data found when processing input)
[vist#0:0/png @ 0x13af04270] [dec:png @ 0x13af06a70] Terminating thread with return code -1145393733 (Error number -1145393733 occurred)
[vost#0:0/libx264 @ 0x13af056b0] [enc:libx264 @ 0x13af05d70] Could not open encoder before EOF
[vost#0:0/libx264 @ 0x13af056b0] Task finished with error code: -22 (Invalid argument)
[vost#0:0/libx264 @ 0x13af056b0] Terminating thread with return code -22 (Invalid argument)
[out#0/mp4 @ 0x13af04580] Nothing was written into output file, because at least one of its streams received no packets.
frame= 0 fps=0.0 q=0.0 Lsize= 0KiB time=N/A bitrate=N/A speed=N/A elapsed=0:00:00.00  
Conversion failed!
