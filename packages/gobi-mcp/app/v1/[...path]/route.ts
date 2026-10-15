import { getGobiHttpHandler } from "../../../src/http.ts";

const handler = getGobiHttpHandler();
export { handler as GET, handler as POST, handler as OPTIONS };
