#!/usr/bin/env python3
"""Build self-contained macOS downloads using verified official runtimes.

Run on macOS with Python 3, Node/npm and Rosetta (to build the Intel package).
Downloaded Arduino tools stay in the release cache, never the user's IDE folders.
"""
import hashlib
import json
import os
from pathlib import Path
import plistlib
import shutil
import subprocess
import sys
import tarfile

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / '.release-cache'
OUTPUT = ROOT / 'releases'
VERSION = '1.0.1'
NODE = '22.23.3'
CLI = '1.5.1'
ASSETS = {
    'arm64': {
        'node': ('https://nodejs.org/dist/v22.23.3/node-v22.23.3-darwin-arm64.tar.gz', '23b25245dcfb9af7262f8ff142e9e2e0af025368117329e7a7458a51e5922f53'),
        'cli': ('https://github.com/arduino/arduino-cli/releases/download/v1.5.1/arduino-cli_1.5.1_macOS_ARM64.tar.gz', 'cb952e8c1621c95ef5f1d17831c945e3d0ec5973f89c557a7ec8feb9c4f7d4c9'),
        'label': 'Apple-Silicon',
    },
    'x86_64': {
        'node': ('https://nodejs.org/dist/v22.23.3/node-v22.23.3-darwin-x64.tar.gz', '8a677b0219178efd6eb0e475457c4afb452b521a92f6e67845a73bd85727f2a8'),
        'cli': ('https://github.com/arduino/arduino-cli/releases/download/v1.5.1/arduino-cli_1.5.1_macOS_64bit.tar.gz', 'c982e940027996bea9901050e95fae99c59c1dcfee54beedecaf28141e7bf2e7'),
        'label': 'Intel',
    },
}

def run(args, **kwargs):
    print('+', ' '.join(map(str,args)), flush=True)
    subprocess.run(list(map(str,args)),check=True,**kwargs)

def fetch(url, digest):
    path=CACHE/url.rsplit('/',1)[-1]
    if not path.exists():
        temporary=path.with_suffix(path.suffix+'.part')
        run(['curl','--fail','--location','--retry','3','--connect-timeout','20','--max-time','600','--silent','--show-error',url,'-o',temporary])
        temporary.rename(path)
    if hashlib.sha256(path.read_bytes()).hexdigest()!=digest:
        raise RuntimeError(f'Checksum mismatch: {path}; delete it and retry.')
    return path

def extract(archive, folder):
    folder.mkdir(parents=True,exist_ok=True)
    # Archives are pinned official files, verified above before extraction.
    with tarfile.open(archive) as tar:
        tar.extractall(folder,filter='data')

def build(arch):
    config=ASSETS[arch]
    base=OUTPUT/f'Arduino-Classroom-{VERSION}-{config["label"]}'
    if base.exists(): shutil.rmtree(base)
    app=base/'Arduino 中文课堂.app'
    contents=app/'Contents'
    resources=contents/'Resources'
    binaries=resources/'bin'
    binaries.mkdir(parents=True)
    (contents/'MacOS').mkdir()
    licenses=resources/'licenses'
    licenses.mkdir()
    for kind in ['node','cli']:
        archive=fetch(*config[kind])
        unpacked=CACHE/f'{kind}-{arch}'
        if unpacked.exists():shutil.rmtree(unpacked)
        extract(archive,unpacked)
        if kind=='node':
            node_root=next(unpacked.glob('node-*'))
            shutil.copy2(node_root/'bin'/'node',binaries/'node')
            shutil.copy2(node_root/'LICENSE',licenses/'Node-LICENSE.txt')
        else:
            shutil.copy2(unpacked/'arduino-cli',binaries/'arduino-cli')
            for filename in ['LICENSE.txt','LICENSE']:
                if (unpacked/filename).exists():shutil.copy2(unpacked/filename,licenses/'Arduino-CLI-LICENSE.txt')
    runtime=CACHE/f'toolchain-{arch}'
    tool_env={**os.environ,
              'ARDUINO_DIRECTORIES_DATA':str(runtime/'data'),
              'ARDUINO_DIRECTORIES_DOWNLOADS':str(runtime/'downloads'),
              'ARDUINO_DIRECTORIES_USER':str(runtime/'sketchbook')}
    # A fresh cache is self-contained and contains no local IDE configuration or inventory.
    if not (runtime/'.complete').exists():
        run([binaries/'arduino-cli','core','update-index'],env=tool_env)
        run([binaries/'arduino-cli','core','install','arduino:avr@1.8.8'],env=tool_env)
        run([binaries/'arduino-cli','lib','install','Servo@1.3.0'],env=tool_env)
        (runtime/'.complete').write_text('avr 1.8.8; Servo 1.3.0')
    toolchain=resources/'toolchain'
    toolchain.mkdir()
    shutil.copytree(runtime/'data',toolchain/'data',ignore=shutil.ignore_patterns('inventory.yaml','tmp','staging','*.log'))
    shutil.copytree(runtime/'sketchbook',toolchain/'sketchbook')
    for path in (toolchain/'data').glob('*.yaml'):path.unlink()
    runtime_app=resources/'app'
    runtime_app.mkdir()
    shutil.copy2(ROOT/'server.mjs',runtime_app/'server.mjs')
    shutil.copytree(ROOT/'dist',runtime_app/'dist')
    for filename in ['package.json','package-lock.json']:
        shutil.copy2(ROOT/'packaging'/'runtime'/filename,runtime_app/filename)
    run(['npm','ci','--omit=dev','--ignore-scripts','--no-audit','--no-fund'],cwd=runtime_app)
    shutil.copy2(ROOT/'packaging'/'boot.mjs',resources/'boot.mjs')
    (resources/'architecture').write_text(arch)
    (resources/'version').write_text(VERSION)
    shutil.copy2(ROOT/'packaging'/'launch-mac',contents/'MacOS'/'ArduinoClassroom')
    (contents/'MacOS'/'ArduinoClassroom').chmod(0o755)
    plist={
        'CFBundleName':'Arduino 中文课堂',
        'CFBundleDisplayName':'Arduino 中文课堂',
        'CFBundleIdentifier':'io.github.evannnx.arduino-classroom',
        'CFBundleExecutable':'ArduinoClassroom',
        'CFBundlePackageType':'APPL',
        'CFBundleShortVersionString':VERSION,
        'CFBundleVersion':'2',
        'LSMinimumSystemVersion':'11.0',
        'LSUIElement':True,
        'NSHighResolutionCapable':True,
        'NSHumanReadableCopyright':'Arduino Classroom; third-party notices in Resources/licenses',
    }
    with (contents/'Info.plist').open('wb') as f:plistlib.dump(plist,f)
    shutil.copy2(ROOT/'packaging'/'stop-mac.command',base/'停止课堂.command')
    (base/'停止课堂.command').chmod(0o755)
    for filename in ['使用说明.md','README.md']:
        shutil.copy2(ROOT/filename,base/filename)
    for filename in ['按钮计时中文积木.jpg','按钮接线图.jpg']:
        shutil.copy2(ROOT/filename,base/filename)
    shutil.copy2(ROOT/'packaging'/'Mac-开始使用.txt',base/'先读我.txt')
    shutil.copy2(ROOT/'packaging'/'THIRD-PARTY.md',licenses/'THIRD-PARTY.md')
    # Obtain the upstream CLI license when release archives omit the license file.
    if not (licenses/'Arduino-CLI-LICENSE.txt').exists():
        run(['curl','-fsSL','--retry','3',f'https://raw.githubusercontent.com/arduino/arduino-cli/v{CLI}/LICENSE.txt','-o',licenses/'Arduino-CLI-LICENSE.txt'])
    run(['curl','-fsSL','--retry','3','https://raw.githubusercontent.com/RaspberryPiFoundation/blockly/blockly-v12.5.1/LICENSE','-o',licenses/'Blockly-LICENSE.txt'])
    # Preserve upstream signatures on official Node and CLI binaries. This wrapper is unsigned.
    archive=Path(str(base)+'.zip')
    if archive.exists():archive.unlink()
    run(['/usr/bin/ditto','-c','-k','--sequesterRsrc','--keepParent',base,archive])
    print(f'Built {archive} ({archive.stat().st_size/1024/1024:.1f} MiB)',flush=True)
    return archive

if __name__=='__main__':
    if sys.platform!='darwin':raise SystemExit('Build this package on macOS.')
    CACHE.mkdir(exist_ok=True);OUTPUT.mkdir(exist_ok=True)
    run(['npm','run','build'],cwd=ROOT)
    archives=[build(arch) for arch in (sys.argv[1:] or ['arm64','x86_64'])]
    # Include all built architectures if invoked separately.
    archives=sorted(OUTPUT.glob(f'Arduino-Classroom-{VERSION}-*.zip'))
    (OUTPUT/'SHA256SUMS.txt').write_text(''.join(f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}\n' for p in archives))
