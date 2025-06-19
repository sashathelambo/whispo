# Whispo

AI-powered dictation tool.

## Download

Currently building for macOS (Apple Silicon) and Windows x64.

[Releases](https://github.com/egoist/whispo/releases/latest)

## Preview


https://github.com/user-attachments/assets/2344a817-f36c-42b0-9ebc-cdd6e926b7a0


## Features

- Hold `Ctrl` key to record your voice, release to transcribe it.
- Automatically insert the transcript into the application you are using.
- Works with any application that supports text input.
- Data is stored locally on your machine.
- Transcrbing with OpenAI Whisper (provided by OpenAI or Groq).
- Support custom API URL so you can use your own API to transcribe.
- Supports post-processing your transcript with LLMs (e.g. OpenAI, Groq and Gemini).

## License

[AGPL-3.0](./LICENSE)

## Development Setup

### Prerequisites

- Node.js (version 22.15.0 or higher)
- pnpm (version 9.12.1 or higher)
- Python 3.12+ (for Windows native module compilation)

### Windows Setup

If you encounter `node-gyp` errors during installation on Windows, follow these steps:

1. **Install Python and set environment variable:**
   ```cmd
   set PYTHON=C:\Users\%USERNAME%\AppData\Local\Programs\Python\Python312\python.exe
   ```

2. **Install node-gyp locally:**
   ```cmd
   pnpm add --save-dev node-gyp
   ```

3. **Install dependencies with script bypass:**
   ```cmd
   pnpm install --ignore-scripts
   ```

4. **For production builds, ensure Visual Studio Build Tools are installed with C++ workload**

### Installation

```bash
# Install dependencies
pnpm install

# Start development server
pnpm run dev

# Build for production
pnpm run build
```
