import { createGobiHttpHandler } from "../../src/http.ts";

const handler = createGobiHttpHandler();

export { handler as GET, handler as POST, handler as DELETE };
