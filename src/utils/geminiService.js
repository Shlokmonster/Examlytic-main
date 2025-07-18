const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export const generateExamQuestions = async (topic, numQuestions = 5) => {
  try {
    if (!GEMINI_API_KEY) {
      console.error('Gemini API key is not set');
      throw new Error('API key is not configured. Please check your environment variables.');
    }

    const prompt = `Generate ${numQuestions} exam questions about ${topic} in the following JSON format. 
    For MCQ questions, include 4 options (A, B, C, D) and specify the correct answer. 
    For answerable questions, provide a detailed correct answer.
    
    Example format for MCQ:
    {
      "question": "What is the capital of France?",
      "type": "mcq",
      "optionA": "London",
      "optionB": "Paris",
      "optionC": "Berlin",
      "optionD": "Madrid",
      "correct_answer": "B"
    }
    
    Example format for answerable question:
    {
      "question": "Explain the concept of React hooks",
      "type": "answerable",
      "correct_answer": "React Hooks are functions that let you use state and other React features without writing classes."
    }
    
    Now generate ${numQuestions} questions about ${topic} in a valid JSON array.`;

    console.log('Sending request to Gemini API...');
    const requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    };

    console.log('Request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': GEMINI_API_KEY
      },
      body: JSON.stringify(requestBody)
    });

    const responseData = await response.json();
    console.log('API Response:', JSON.stringify(responseData, null, 2));

    if (!response.ok) {
      const errorMessage = responseData.error?.message || `HTTP error! status: ${response.status}`;
      console.error('API Error:', errorMessage);
      throw new Error(`API Error: ${errorMessage}`);
    }

    const generatedText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!generatedText) {
      console.error('No generated text in response');
      throw new Error('No content was generated. Please try again.');
    }

    console.log('Generated text:', generatedText);

    // Extract JSON from the response
    const jsonMatch = generatedText.match(/\[([\s\S]*?)\]/);
    if (!jsonMatch) {
      console.error('Could not find JSON array in response');
      throw new Error('Could not parse the generated content. Please try again.');
    }

    try {
      // Parse the JSON array
      const questions = JSON.parse(jsonMatch[0]);
      console.log('Parsed questions:', questions);
      return questions;
    } catch (parseError) {
      console.error('Error parsing JSON:', parseError);
      throw new Error('Failed to parse the generated questions. Please try again.');
    }
  } catch (error) {
    console.error('Error in generateExamQuestions:', error);
    throw error; // Re-throw the error to be handled by the caller
  }
};
