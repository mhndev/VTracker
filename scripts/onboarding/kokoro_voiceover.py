import argparse

import soundfile as sf
from kokoro_onnx import Kokoro


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a local Kokoro voiceover.")
    parser.add_argument("--model", required=True)
    parser.add_argument("--voices", required=True)
    parser.add_argument("--voice", default="af_heart")
    parser.add_argument("--speed", type=float, default=0.96)
    parser.add_argument("--output", required=True)
    parser.add_argument("--text", required=True)
    args = parser.parse_args()

    kokoro = Kokoro(args.model, args.voices)
    samples, sample_rate = kokoro.create(
        args.text,
        voice=args.voice,
        speed=args.speed,
        lang="en-us",
    )
    sf.write(args.output, samples, sample_rate, subtype="PCM_16")


if __name__ == "__main__":
    main()
