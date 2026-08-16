'use server';
/**
 * @fileOverview Provides intelligent suggestions for customers and products based on a query.
 *
 * - semanticSuggestCustomersProducts - A function that handles semantic search for customers or products.
 * - SemanticSuggestInput - The input type for the semanticSuggestCustomersProducts function.
 * - SemanticSuggestOutput - The return type for the semanticSuggestCustomersProducts function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SemanticSuggestInputSchema = z.object({
  query: z.string().describe('The search query provided by the user.'),
  type: z
    .union([z.literal('customer'), z.literal('product')])
    .describe('The type of entity to search for: "customer" or "product".'),
  customers: z
    .array(
      z.object({
        id: z.string().describe('Unique ID of the customer.'),
        name: z.string().describe('Name of the customer.'),
      })
    )
    .optional()
    .describe('List of available customer data to search from.'),
  products: z
    .array(
      z.object({
        id: z.string().describe('Unique ID of the product.'),
        name: z.string().describe('Name of the product.'),
        stock: z.number().int().min(0).describe('Current stock quantity of the product.'),
        imageUrl: z.string().optional().describe('URL or data URI of the product\'s primary image.'),
      })
    )
    .optional()
    .describe('List of available product data to search from.'),
});
export type SemanticSuggestInput = z.infer<typeof SemanticSuggestInputSchema>;

const SemanticSuggestOutputSchema = z.object({
  suggestions: z
    .array(
      z.union([
        z.object({
          id: z.string().describe('Unique ID of the suggested customer.'),
          name: z.string().describe('Name of the suggested customer.'),
          type: z.literal('customer').describe('Indicates this is a customer suggestion.'),
        }),
        z.object({
          id: z.string().describe('Unique ID of the suggested product.'),
          name: z.string().describe('Name of the suggested product.'),
          stock: z
            .number()
            .int()
            .min(0)
            .describe('Current stock quantity of the suggested product.'),
          imageUrl:
            z.string().optional().describe('URL or data URI of the suggested product\'s primary image.'),
          type: z.literal('product').describe('Indicates this is a product suggestion.'),
        }),
      ])
    )
    .describe('A list of suggested customers or products matching the query.'),
});
export type SemanticSuggestOutput = z.infer<typeof SemanticSuggestOutputSchema>;

export async function semanticSuggestCustomersProducts(
  input: SemanticSuggestInput
): Promise<SemanticSuggestOutput> {
  return semanticSuggestCustomersProductsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'semanticSuggestCustomersProductsPrompt',
  input: {schema: SemanticSuggestInputSchema},
  output: {schema: SemanticSuggestOutputSchema},
  prompt: `You are an intelligent suggestion system for a sales application.
Your goal is to provide accurate and relevant suggestions for customers or products based on a user's search query.

It is crucial that the suggestion engine is resilient to:
- Case-insensitivity: "apple" should match "Apple" or "APPLE".
- Accent-insensitivity: "café" should match "cafe" or "CAFE".
- Typo tolerance: Minor spelling mistakes or phonetic similarities should still yield relevant suggestions.

Only suggest items that are explicitly provided in the relevant list below. If no suitable matches are found, return an empty array.

The user is looking for a '{{{type}}}' with the query: '{{{query}}}'.

Available Data:
{{#if customers}}
Customers:
{{#each customers}}
- id: "{{{this.id}}}", name: "{{{this.name}}}"
{{/each}}
{{/if}}

{{#if products}}
Products:
{{#each products}}
- id: "{{{this.id}}}", name: "{{{this.name}}}", stock: {{{this.stock}}}, imageUrl: "{{{this.imageUrl}}}"
{{/each}}
{{/if}}

Based on the 'type' field and the 'query', select up to 5 best matching items from the relevant list (customers or products). Ensure the 'type' field in each suggestion object exactly matches the requested 'type'.`,
});

const semanticSuggestCustomersProductsFlow = ai.defineFlow(
  {
    name: 'semanticSuggestCustomersProductsFlow',
    inputSchema: SemanticSuggestInputSchema,
    outputSchema: SemanticSuggestOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
