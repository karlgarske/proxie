# Chat Interface Feature

## Client

### UX Flow

#### Critical Path

- user opens the root directory of the client and sees a chat input box pompting them to enter a message
- user enters a message and hits enter or presses a send button
- client creates a new conversationId in the background (and stores it in memory until the page is refreshed or conversation has expired)
- client shows the last user message in the chat window and shows a loading indicator while waiting for a response
- client shows an empty response message in the chat window to be filled in as the response arrives
- client posts a new json message using an sse endpoint /api/responses/sse
- client consumes the sse response stream and appends the text to the response message placeholder as it arrives
- client updates the responseId and expiration time for the conversation with each new message received

#### Edge Cases & Constraints

- user can clear their conversation history by refreshing the page or clicking an exit button
- client only shows the last user message and response in the chat window
- client handles network errors and displays an error message in the chat window
- client handles server errors and displays an error message in the chat window
- client handles expired conversations by displaying a message in the chat window and prompting the user to start a new conversation

### Message Payload

```
{
  conversationId: string; //uuidv4
  responseId?: string; //empty for first message, otherwise the last responseId received
  text: string;
}
```

## API Server

### Endpoint

- server exposes a POST endpoint at /api/responses/sse that receives the message payload

### Request Validation

- server checks if the conversationId and responseId matches the last message it returned, and returns a 403 if they do not match
- server checks if the conversation has expired, and returns a 404 if it has

### Response Generation

- server constructs a system message for the conversation
- server set up an sse response stream and uses the OpenAI repsonsesAPI to pipe the generated stream into the response back to the client
- server flushes the sse stream with each 5 new chunks of text received
- server includes the responseId and conversation expiration date in the sse stream as a special message type
- server flushes the sse stream and closes the connection when the response is complete
- server updates the conversation with the new responseId when done

#### Modes

- server only generates text responses for now, but will support images and other media types later

#### SSE Event Types

- textStart: indicates the start of a new response message
- text: a chunk of text from the response
- message: a json object containing the responseId and expiration date
- complete: indicates the response is complete

### Error Handling

- server handles network errors and returns a 500 if the OpenAI API call fails
- server handles validation errors and returns a 400 if the request payload is invalid

### Configuration

- OpenAI API key is stored in an environment variable and set by secret manager upon deployment
- OpenAI model is configurable via an environment variable, defaulting to gpt-4
- OpenAI token limit is configurable via an environment variable, defaulting to 1000 tokens

### Persistence

- conversations are stored in memory for now, but will be stored in a database later
- each conversation keeps a reference to the last responseId
- each new message for a conversation updates the expiration date by 30 minutes

## Standards

- refer to ./intent/core/standards.md for coding standards and best practices
