# Minimal React DevTools

## Project Overview
Minimal React DevTools is a lightweight Chrome extension that provides essential React debugging capabilities without interfering with the official React DevTools. It offers a streamlined interface for inspecting React component hierarchies and state.

## Basic Component Diagram
```
+-------------+     +-------------+     +-------------+
|  Web Page   |     |   Chrome    |     |  DevTools   |
|             |     |  Extension  |     |    Page     |
| +---------+ |     | +---------+ |     | +---------+ |
| |inject.js| |<--->| |background| |<--->| |devtools| |
| +---------+ |     | |   .js   | |     | |   .js   | |
|      ^      |     | +---------+ |     | +---------+ |
|      |      |     |      ^      |     |      ^      |
|      v      |     |      |      |     |      v      |
| +---------+ |     |      |      |     | +---------+ |
| | React   | |     |      |      |     | | panel  | |
| | Fiber   | |     |      |      |     | |  .js   | |
| +---------+ |     |      |      |     | +---------+ |
+-------------+     +-------------+     +-------------+
```

## Component Descriptions

1. **inject.js**:
   - Injected into the web page
   - Interacts directly with React internals
   - Serializes Fiber tree for transmission
   - Handles component highlighting and selection

2. **background.js**:
   - Manages the extension's background processes
   - Handles message routing between content script and DevTools

3. **devtools.js**:
   - Initializes the DevTools panel
   - Sets up communication channel with background.js
   - Manages DevTools-specific functionality

4. **panel.js**:
   - Implements the UI of the custom DevTools panel
   - Renders component tree and details
   - Sends user interactions back through the extension

## React Fiber Representation and Component Interaction

### Fiber Tree Structure

The extension interacts with React's internal Fiber tree, which represents the component hierarchy. Each Fiber node contains:

- Tag (indicating component type)
- Key
- Element type
- Component type
- State node (DOM node for host components)
- Child and sibling references

### Serialization

The Fiber tree is serialized in `inject.js` to create a lightweight representation:

```javascript
function serializeFiber(fiber, depth = 0) {
  if (!fiber || depth > 50) return null;
  return {
    tag: fiber.tag,
    key: fiber.key,
    elementType: fiber.elementType ? (typeof fiber.elementType === 'string' ? fiber.elementType : fiber.elementType.name || String(fiber.elementType)) : null,
    type: fiber.type ? (typeof fiber.type === 'string' ? fiber.type : fiber.type.name || String(fiber.type)) : null,
    stateNode: fiber.stateNode ? (fiber.stateNode.nodeType ? fiber.stateNode.nodeName : 'NonDOMNode') : null,
    child: serializeFiber(fiber.child, depth + 1),
    sibling: serializeFiber(fiber.sibling, depth),
  };
}
```

### Component Highlighting


Highlighting process:

1. User hovers over a component in the DevTools panel
2. Panel sends a highlight message through the extension
3. `inject.js` receives the message and finds the corresponding DOM node
4. The DOM node is highlighted using CSS styles

```javascript
function highlightNode(fiber) {
  let node = findHostDOMNode(fiber);
  if (node && node.nodeType === Node.ELEMENT_NODE) {
    node.style.outline = '2px solid red';
    node.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
  }
}
```

### Component Selection

Selection for inspection:

1. User activates inspection mode in the DevTools panel
2. `inject.js` listens for mouse events on the page
3. As the user moves the mouse, the React component under the cursor is identified
4. On click, the selected component's details are sent to the DevTools panel

```javascript
function onInspectElement(event) {
  const fiber = findFiberForDOMNode(event.target);
  if (fiber) {
    sendToDevTools('inspectedElement', serializeFiber(fiber));
  }
}
```

## Installation

1. Clone this repository:
   ```
   git clone https://github.com/your-repo/minimal-react-devtools.git
   ```
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the cloned repository folder

## Usage

1. Open DevTools in a web page running a React application
2. Navigate to the "Minimal React" panel
3. Use the component tree to inspect React elements
4. Click on components to view their props and state
5. Use the inspect button to select components directly from the page

## Testing

Run the automated tests:

```
make test
```

For debugging tests with additional logging:

```
make debug-test
```

## Detailed Architecture and Message Passing

### Basic Message Flow
```
+-------------+     +-------------+     +-------------+
|  Web Page   |     |  Extension  |     |  DevTools   |
|             |     |             |     |             |
| 1. Event    |     |             |     |             |
| +---------+ |     |             |     |             |
| |inject.js| |  2  |             |     |             |
| +---------+ | --> |             |  3  |             |
|             |     |             | --> |             |
|             |     |             |     | 4. Update UI|
+-------------+     +-------------+     +-------------+
```

1. React updates trigger events in the web page
2. `inject.js` sends a message to the extension
3. The extension forwards the message to DevTools
4. DevTools updates its UI based on the message

### Intermediate Message Flow
```
+-------------+     +-------------+     +-------------+
|  Web Page   |     |  Extension  |     |  DevTools   |
|             |     |             |     |             |
| 1. Event    |     |             |     |             |
| +---------+ |  2  | +---------+ |  3  | +---------+ |
| |inject.js|-|-->|-|background|-|-->|-|devtools.js| |
| +---------+ |     | |   .js   | |     | +---------+ |
|             |     | +---------+ |     |      |      |
|             |     |             |     |      v      |
|             |     |             |     | +---------+ |
|             |     |             |     | | panel.js| |
|             |     |             |     | +---------+ |
|             |     |             |     | 4. Update UI|
+-------------+     +-------------+     +-------------+
        ^                  |                   |
        |                  |                   |
        +------------------+-------------------+
                 5. User Interaction
```

1. React updates trigger events in the web page
2. `inject.js` sends a message to `background.js`
3. `background.js` forwards the message to `devtools.js`
4. `panel.js` updates the UI based on the message
5. User interactions in DevTools trigger messages back to the web page

### Advanced Message Flow
```
+-------------------+     +-------------------+     +-------------------+
|     Web Page      |     |     Extension     |     |     DevTools      |
|                   |     |                   |     |                   |
| +---------------+ |     | +---------------+ |     | +---------------+ |
| |   React App   | |     | |  background   | |     | |   devtools    | |
| |   +-------+   | |  2  | |     .js       | |  3  | |     .js       | |
| |   | Fiber |---|-->|---|-->|-------------|-->|---|-->|-----------+ | |
| |   | Tree  |   | |     | |               | |     | |             | | |
| |   +-------+   | |     | |               | |     | |     4       | | |
| |       ^       | |     | |               | |     | |     |       | | |
| |     1 |       | |     | |               | |     | |     v       | | |
| |       v       | |     | |               | |     | | +-------+   | | |
| | +----------+  | |     | |               | |     | | |panel.js|  | | |
| | | inject.js |  | |     | |               | |     | | +-------+  | | |
| | +----------+  | |     | |               | |     | |     ^       | | |
| |       ^       | |     | |               | |     | |     |       | | |
| |       |       | |     | |               | |     | |     5       | | |
| +-------|-------+ |     | +---------------|-----+ | +------|-------+ | |
|         |         |     |                 |     | |        |         | |
+---------|---------+     +-----------------|---------+------|----------+
          |                                 |                |
          |                6                |                |
          +---------------------------------+----------------+
```

1. React updates its Fiber Tree
2. `inject.js` observes changes and sends serialized data to `background.js`
3. `background.js` forwards the message to `devtools.js`
4. `devtools.js` passes the data to `panel.js`
5. `panel.js` updates the UI with the new component information
6. User interactions in DevTools trigger messages that flow back to `inject.js` for actions like highlighting or inspecting components

This advanced flow shows the detailed path of messages as they travel between different parts of the extension, and how user interactions can trigger reverse message flows for features like component highlighting and inspection.

## Contributing

1. Fork the repository
2. Create a new branch for your feature
3. Make your changes and commit them
4. Push to your fork and submit a pull request

Please ensure that your code adheres to the existing style and passes all tests before submitting a pull request.