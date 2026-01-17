#!/bin/bash
# Run script for AI Scan CLI

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Default values
INPUT=""
OUTPUT="./results"
VERBOSE=""
DRY_RUN=""
MINI_BATCH_SIZE=""

# Help message
show_help() {
    echo "AI Scan CLI - Run Script"
    echo ""
    echo "Usage: ./run.sh -i <input> -o <output> [options]"
    echo ""
    echo "Required:"
    echo "  -i, --input <file|dir>   Input CSV file or directory"
    echo "  -o, --output <dir>       Output directory (default: ./results)"
    echo ""
    echo "Options:"
    echo "  -m, --mini-batch <n>     URLs per Claude invocation (1-10, default: 5)"
    echo "  -v, --verbose            Show detailed output"
    echo "  -d, --dry-run            Preview batch plan without processing"
    echo "  -c, --check              Check prerequisites only"
    echo "  -h, --help               Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./run.sh -i pending-scans.csv -o ./results/"
    echo "  ./run.sh -i ./input-dir/ -o ./results/ -v"
    echo "  ./run.sh -i scans.csv -m 1 --verbose"
    echo "  ./run.sh --check"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -i|--input)
            INPUT="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT="$2"
            shift 2
            ;;
        -m|--mini-batch)
            MINI_BATCH_SIZE="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE="--verbose"
            shift
            ;;
        -d|--dry-run)
            DRY_RUN="--dry-run"
            shift
            ;;
        -c|--check)
            echo "Checking prerequisites..."
            node dist/cli.js --check-prerequisites
            exit $?
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Check if dist exists
if [ ! -f "dist/cli.js" ]; then
    echo "Error: CLI not built. Run ./build.sh first"
    exit 1
fi

# Validate input
if [ -z "$INPUT" ]; then
    echo "Error: Input file or directory is required"
    echo ""
    show_help
    exit 1
fi

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT"

# Build command
CMD="node dist/cli.js"

# Determine if input is file or directory
if [ -d "$INPUT" ]; then
    CMD="$CMD --input-dir \"$INPUT\""
else
    CMD="$CMD --input \"$INPUT\""
fi

CMD="$CMD --output \"$OUTPUT\""

if [ -n "$MINI_BATCH_SIZE" ]; then
    CMD="$CMD --mini-batch-size $MINI_BATCH_SIZE"
fi

if [ -n "$VERBOSE" ]; then
    CMD="$CMD $VERBOSE"
fi

if [ -n "$DRY_RUN" ]; then
    CMD="$CMD $DRY_RUN"
fi

# Show what we're running
echo "=== AI Scan CLI ==="
echo "Input:  $INPUT"
echo "Output: $OUTPUT"
echo ""

# Run the command
eval $CMD
