'use server';
/**
 * @fileOverview An AI assistant for generating compelling and consistent product descriptions.
 *
 * - generateProductDescription - A function that generates a product description.
 * - GenerateProductDescriptionInput - The input type for the generateProductDescription function.
 * - GenerateProductDescriptionOutput - The return type for the generateProductDescription function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateProductDescriptionInputSchema = z.object({
  productName: z.string().describe('The name of the product.'),
  category: z.string().describe('The category the product belongs to.'),
  existingDescription: z
    .string()
    .optional()
    .describe('An optional existing description to build upon or refine.'),
});
export type GenerateProductDescriptionInput = z.infer<
  typeof GenerateProductDescriptionInputSchema
>;

const GenerateProductDescriptionOutputSchema = z.object({
  description: z.string().describe('The generated compelling product description.'),
});
export type GenerateProductDescriptionOutput = z.infer<
  typeof GenerateProductDescriptionOutputSchema
>;

export async function generateProductDescription(
  input: GenerateProductDescriptionInput
): Promise<GenerateProductDescriptionOutput> {
  return generateProductDescriptionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateProductDescriptionPrompt',
  input: {schema: GenerateProductDescriptionInputSchema},
  output: {schema: GenerateProductDescriptionOutputSchema},
  prompt: `You are an expert copywriter specializing in creating compelling and consistent product descriptions for a high-end fashion and logistics company called StiloStack.

Your task is to generate an engaging product description based on the provided product details.
Focus on highlighting key features, benefits, and the overall aesthetic, ensuring the tone is sophisticated and attractive.

Product Name: {{{productName}}}
Category: {{{category}}}

{{#if existingDescription}}
Here is an existing description you can use as a base or reference, but feel free to enhance or rewrite it to be more compelling and consistent:
"""
{{{existingDescription}}}
"""
{{/if}}

Please generate a detailed and appealing product description that will attract customers to the product catalog and web store.`,
});

const generateProductDescriptionFlow = ai.defineFlow(
  {
    name: 'generateProductDescriptionFlow',
    inputSchema: GenerateProductDescriptionInputSchema,
    outputSchema: GenerateProductDescriptionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
