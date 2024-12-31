<p align="center">
  <img width="30%" src="chromeExtension/icon.svg">
</p>


# Chrome Gestures with Path Drawing

A Chrome extension that enables mouse gesture navigation with visual feedback. Draw gestures with your mouse to perform common browser actions like navigating back/forward, closing tabs, and reopening closed tabs.

## Features

### Mouse Gestures
- **Back**: Draw Left (L)
- **Forward**: Draw Right (R)
- **Close Tab**: Draw Down-Right (DR)
- **Reopen Closed Tab**: Draw Up-Right (UR)

### Visual Feedback
- Real-time gesture path visualization
- Color-coded gestures:
  - Up movements: Blue gradient
  - Down movements: Red gradient
  - Right movement: Green gradient
  - Left movement: Purple gradient
- Dynamic line width that grows towards cursor
- Smooth trailing effect
- Visual abort feedback (turns gray)

### Customization
- Configurable activation buttons:
  - Middle Mouse Button (Button 1)
  - Right Mouse Button (Button 2)
  - Mouse Button 4
  - Mouse Button 5

### Smart Features
- Gesture abort: Continue drawing after a valid gesture to cancel it
- Automatic gesture recognition
- Smooth gesture trails with limited length
- Settings persistence across browser sessions

## Usage

1. Hold down your chosen activation button (default: Right Mouse Button)
2. Draw one of the supported gestures
3. Release the button to execute the gesture

To abort a gesture:
1. Start drawing a gesture
2. If you want to cancel, just keep drawing
3. The path will turn gray to indicate abortion
4. Release to cancel without executing any action

## Installation

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension directory

## Permissions Required
- `sessions`: For reopening closed tabs
- `storage`: For settings persistence

## Technical Details

- Uses Canvas API for smooth gesture drawing
- Implements gradient-based visual feedback
- Features dynamic line width and opacity
- Employs quadratic curves for smooth path rendering
- Includes debug logging for troubleshooting

## Contributing

Feel free to submit issues and enhancement requests!

## License

[MIT License](LICENSE)

## Credits

Created by [antnsn](https://github.com/antnsn)