import 'dotenv/config'
import { streamText } from 'ai'

const result = streamText({
  model: 'openai/gpt-5.4',
  prompt: 'Explain quantum computing in simple terms.',
})

for await (const chunk of result.textStream) {
  process.stdout.write(chunk)
}

const usage = await result.usage
process.stdout.write('\n\n')
console.log('Token usage:', usage)
