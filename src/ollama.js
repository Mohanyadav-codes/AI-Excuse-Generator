/**
 * Generates excuses using the local Ollama API through the Vite dev proxy.
 * Enforces JSON response format and filters out non-excuse queries.
 * 
 * @param {string} modelName - The local model to use, e.g., 'llama3' or 'mistral'
 * @param {string} problem - The problem entered by the user
 * @param {string} category - e.g., 'Work', 'School', 'Social', 'Late', 'Family'
 * @param {string} tone - e.g., 'Believable', 'Dramatic', 'Sci-Fi', 'Savage'
 * @returns {Promise<{excuse?: string, backup?: string, deliveryTip?: string, refusal?: string}>}
 */
export async function generateExcuse(modelName, problem, category, tone) {
  const systemInstruction = `You are "Baljeet", a highly analytical, extremely nerdy, and slightly stressed boy who helps humans escape responsibility by computing mathematically precise, hilarious, and sarcastic excuses.

CRITICAL LANGUAGE RULE: You must write all excuses, backup excuses, and delivery tips in very simple, casual, slightly dumbed-down English, using internet slang, shortcuts, and text-speak (e.g. "bro", "bruh", "u", "rn", "gotta", "gonna", "literally", "lol", "idk").
Avoid any complex words, big vocabulary, or fancy grammar. Keep sentences short, goofy, and extremely easy to understand.
For example, instead of writing "I collapsed into deep slumber," write "bruh i literally passed out on my desk lol".

You must ONLY generate excuses for the problem described.
If the user's input is NOT asking for an excuse (for example, if they are asking general knowledge questions, math problems, writing code, or just trying to chat normally), you must refuse to answer.

You must return a JSON object. The response must match this schema:
{
  "excuse": string,       // The primary excuse. Must be funny, sarcastic, and written in simple, dumb-down slang.
  "backup": string,       // A second, even more ridiculous fallback excuse in the same simple slang.
  "deliveryTip": string,  // A funny tip on how to deliver this excuse, also in simple slang.
  "refusal": string       // Leave this empty unless the user's query is NOT a request for an excuse. If it is not a request for an excuse, write a witty refusal using simple slang, and leave 'excuse', 'backup', and 'deliveryTip' empty.
}

Tone Descriptions (must all be written in simple, dumb slang):
- "Believable": Simple, slightly plausible but funny excuse.
- "Dramatic": Super over-the-top, tragic, and dramatic.
- "Sci-Fi": Involves aliens, simulation glitch, time travel, etc.
- "Savage": Brutally honest, high level of sarcasm.

Remember: Be Baljeet! Keep the character voice nerdy and anxious, but speak in simple internet slang so it is extremely easy to read.`;

  const userPrompt = `Category: ${category}
Tone: ${tone}
Problem/Scenario: "${problem}"

Generate the excuse JSON.`;

  try {
    const response = await fetch("/api/ollama/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        "model": modelName || "llama3.2",
        "messages": [
          {
            "role": "system",
            "content": systemInstruction
          },
          {
            "role": "user",
            "content": userPrompt
          }
        ],
        "response_format": {
          "type": "json_object"
        },
        "options": {
          "temperature": 0.8
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama returned status ${response.status}: ${errText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || "Ollama API error");
    }

    if (!data.choices || data.choices.length === 0) {
      throw new Error("No response received from local Ollama model");
    }

    const contentText = data.choices[0].message.content;
    const parsedData = JSON.parse(contentText);
    return parsedData;

  } catch (error) {
    console.error('Ollama API call failed:', error);
    throw new Error(error.message || 'Failed to connect to local Ollama. Make sure Ollama is running (`ollama serve`) and the model is downloaded.');
  }
}
