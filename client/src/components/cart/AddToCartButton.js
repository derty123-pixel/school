import React from 'react';
import { useCart } from '../../context/CartContext'; // Corrected path

const AddToCartButton = ({ productId, productToAdd, productName = "this product" }) => {
  // productToAdd should be an object like { id, name, price, image_url (optional) }
  // It's needed by the addItemToCart action in CartContext to add to the local state optimistically
  // or at least provide enough info if the backend response is just a success/fail.
  // However, our current CartContext reloads the whole cart from backend response.
  // So, only productId is strictly needed for the API call.
  // Let's assume for now productToAdd is the full product object for local state updates if we were to do them,
  // but the action will primarily use productId for the API.

  const { state, addItemToCart } = useCart();
  const { isLoading } = state;

  const handleClick = async () => {
    if (!productToAdd || !productToAdd.id) {
        console.error("AddToCartButton: productToAdd prop with id is required.");
        // Potentially show an error to the user or disable the button
        return;
    }
    console.log(`Attempting to add product ${productToAdd.id} to cart.`);
    try {
      // The addItemToCart action in context now handles API call
      // It expects productId and quantity.
      await addItemToCart(productToAdd.id, 1); 
      // Optionally, show success feedback (e.g., toast notification)
      console.log(`Product ${productToAdd.name || productToAdd.id} added to cart successfully (pending UI update from state).`);
    } catch (error) {
      // Error is handled in context and can be displayed globally or locally
      console.error(`AddToCartButton: Failed to add product ${productToAdd.id}. Error: ${error.message}`);
      // Optionally, show error feedback to user here
      alert(`Failed to add ${productName} to cart. ${error.response?.data?.message || error.message || ''}`);
    }
  };

  return (
    <button 
      onClick={handleClick} 
      disabled={isLoading}
      aria-label={`Add ${productName || productToAdd?.name} to cart`}
      style={{
        padding: '10px 15px',
        fontSize: '1rem',
        color: 'white',
        backgroundColor: isLoading ? '#ccc' : '#007bff', // Grey out when loading
        border: 'none',
        borderRadius: '5px',
        cursor: isLoading ? 'not-allowed' : 'pointer',
        margin: '5px 0'
      }}
    >
      {isLoading ? 'Adding...' : 'Add to Cart'}
    </button>
  );
};

export default AddToCartButton;
