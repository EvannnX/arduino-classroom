# Bundled third-party software

This distribution includes the following upstream components. Their license files
are preserved in this directory, in npm package directories, and in the Arduino
toolchain directories. The application is not affiliated with Arduino.

- Node.js 22.23.3: MIT and bundled dependency licenses, see `Node-LICENSE.txt`.
  Source: https://github.com/nodejs/node/tree/v22.23.3
- Arduino CLI 1.5.1: GPL-3.0, see `Arduino-CLI-LICENSE.txt`.
  Corresponding source: https://github.com/arduino/arduino-cli/tree/v1.5.1
- Arduino AVR Boards 1.8.8 and its official compiler, uploader, discovery and
  monitoring dependencies: upstream licenses included with each component.
  Core source: https://github.com/arduino/ArduinoCore-avr/tree/1.8.8
  Official package manifest (includes source/tool URLs):
  https://downloads.arduino.cc/packages/package_index.json
  AVR GCC corresponding toolchain source distribution:
  https://github.com/arduino/toolchain-avr
  AVRDUDE source: https://github.com/arduino/avrdude
  Ctags source: https://github.com/arduino/ctags
  Discovery/monitor sources: https://github.com/arduino/serial-discovery,
  https://github.com/arduino/mdns-discovery,
  https://github.com/arduino/dfu-discovery,
  https://github.com/arduino/serial-monitor
- Servo 1.3.0: LGPL-2.1-or-later, copyright and license in the library sources.
  Source: https://github.com/arduino-libraries/Servo/tree/1.3.0
- Blockly 12.5.1: Apache-2.0; see `Blockly-LICENSE.txt`.
  Source: https://github.com/google/blockly
- Express, SerialPort, and transitive npm dependencies: individual licenses
  shipped in `app/node_modules`; exact versions in `app/package-lock.json`.

Official runtimes are downloaded from Node.js and Arduino release servers. The
packaging script pins SHA-256 checksums for Node.js and Arduino CLI; Arduino CLI
checks the tool archives against the official package index. All are unmodified.
