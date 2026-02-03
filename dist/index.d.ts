import "dotenv/config";
import { Probot } from "probot";
import { IncomingMessage, ServerResponse } from "node:http";
interface ApplicationFunctionOptions {
    addHandler: (handler: (req: IncomingMessage, res: ServerResponse) => boolean | void | Promise<boolean | void>) => void;
    [key: string]: unknown;
}
declare const app: (probotApp: Probot, options: ApplicationFunctionOptions) => Promise<void>;
export default app;
