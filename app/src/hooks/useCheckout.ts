import { useState } from 'react';

export const useCheckout = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createCheckoutSession = async (bookId: string, bookTitle: string, accountEmail?: string) => {
    setLoading(true);
    setError(null);

    try {
      // Use the provided API_URL or fallback to relative path for better production compatibility
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${baseUrl}/create-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bookId, bookTitle, accountEmail }),
      });

      if (!response.ok) {
        const errorData: { error?: string } = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const { url } = await response.json();

      if (url) {
        // Redirect to Stripe checkout
        window.location.href = url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      console.error('Checkout error:', err);
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    createCheckoutSession,
  };
};