// test_gelato_connection.ts
import axios from 'axios';
import 'dotenv/config';

async function testGelatoConnection() {
  console.log('🔌 Testing Gelato API connection...');

  try {
    const response = await axios.get('https://api.gelato.com/v2/products', {
      headers: {
        'Authorization': `Bearer ${process.env.GELATO_API_KEY!}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Gelato API connection successful');
    console.log(`📊 Found ${response.data.products?.length || 0} products`);
    
    if (response.data.products && response.data.products.length > 0) {
      console.log('📋 Sample product:', response.data.products[0].name);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Gelato API connection failed:', (error as any).response?.data || (error as any).message);
    return false;
  }
}

if (require.main === module) {
  testGelatoConnection().catch(console.error);
}

export { testGelatoConnection };