import OpenAI from "openai";
import { wrapOpenAI } from "langsmith/wrappers";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const openai = wrapOpenAI(client);
