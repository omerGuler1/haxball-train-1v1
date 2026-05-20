export const ControlMsgType = Object.freeze({
  HELLO: "hello",
  CONTROL: "control",
  RELEASE: "release",
  PING: "ping",
  PONG: "pong",
});

export function makeHello({ name }) {
  return { t: ControlMsgType.HELLO, name };
}
