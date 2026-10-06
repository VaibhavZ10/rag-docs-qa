import express from "express";
import dotenv from "dotenv";
import { searchDocs } from "./search";
import Groq from "groq-sdk";

dotenv.config();
const app = express();
app.use(express.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.post("/ask", async (req: express.Request, res: express.Response) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: "question is required" });

    const chunks = await searchDocs(question, 5);
    const context = chunks.map((c, i) => `[${i + 1}] ${c.text}`).join("\n\n");

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "Answer the question using only the provided context. If the context doesn't contain the answer, say so.",
        },
        { role: "user", content: `Context:\n${context}\n\nQuestion: ${question}` },
      ],
    });

    res.json({
      answer: completion.choices[0]?.message?.content ?? "",
      sources: chunks.map(c => ({ source_file: c.source_file, preview: c.text.slice(0, 150) })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));