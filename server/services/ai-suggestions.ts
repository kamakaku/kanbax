import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateTaskSuggestions(
  boardTitle: string,
  boardDescription: string | null,
  existingTasks: { title: string; description: string | null }[]
): Promise<string[]> {
  try {
    console.log("Starting task suggestion generation for board:", boardTitle);
    console.log("Using API key:", process.env.OPENAI_API_KEY ? "Key present" : "Key missing");

    const prompt = `As an AI task manager, analyze this Kanban board and suggest 3 new tasks.

Board: ${boardTitle}
Description: ${boardDescription || 'No description'}

Current tasks:
${existingTasks.map(task => `- ${task.title}: ${task.description || 'No description'}`).join('\n')}

Based on this context, suggest 3 new tasks that would help progress this project. Format each task as a bullet point with a title and brief description.`;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "gpt-3.5-turbo",
      temperature: 0.7,
      max_tokens: 150,
    });

    const suggestions = completion.choices[0].message.content
      ?.split('\n')
      .filter(line => line.trim().startsWith('-'))
      .map(line => line.trim().substring(2));

    console.log("Successfully generated suggestions:", suggestions);
    return suggestions || [];
  } catch (error) {
    console.error('Error generating task suggestions:', error);
    if ((error as any).status === 401) {
      throw new Error('Invalid API key. Please check your OpenAI API key configuration.');
    } else if ((error as any).status === 429) {
      throw new Error('API rate limit exceeded. Please try again later.');
    } else {
      throw new Error('Failed to generate task suggestions. Please try again later.');
    }
  }
}