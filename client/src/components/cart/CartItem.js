import React, { useState, useEffect } from 'react';
import { useCart } from '../../context/CartContext'; // Corrected path

const CartItem = ({ item }) => {
  const { state, updateItemQuantityInCart, removeItemFromCart } = useCart();
  const { isLoading } = state;

  if (!item || !item.product_id) { // Check for product_id as it's a key FK from backend schema
    return <tr><td colSpan="5">Invalid item data. Item: {JSON.stringify(item)}</td></tr>;
  }

  const [quantity, setQuantity] = useState(item.quantity);

  useEffect(() => {
    setQuantity(item.quantity);
  }, [item.quantity]);

  const handleQuantityChange = async (newQuantityStr) => {
    const newQuantity = parseInt(newQuantityStr, 10);
    if (isNaN(newQuantity) || newQuantity < 0) { // Allow 0 for input, but API/service might treat as delete
        setQuantity(0); // Visually update, actual logic below
        // Do not call update yet, let user finish typing or use +/-
        return;
    }
    setQuantity(newQuantity); // Optimistic UI update for input field

    // Call API only if quantity is valid and changes (or on blur/specific update button)
    // For simplicity, let's call it directly, but debounce/blur is better for text input.
    // If user types "0", it should be treated as a remove for this item.
    if (newQuantity === 0) {
        try {
            await removeItemFromCart(item.item_id || item.id); // item.id is fallback if item_id (cart_item_id) isn't there
        } catch (error) {
            // Error handled by context, but can add local feedback
            setQuantity(item.quantity); // Revert optimistic update on error
        }
    } else if (newQuantity > 0) {
        try {
            await updateItemQuantityInCart(item.item_id || item.id, newQuantity);
        } catch (error) {
            setQuantity(item.quantity); // Revert
        }
    }
  };
  
  const handleIncreaseQuantity = async () => {
    const newQuantity = quantity + 1;
    setQuantity(newQuantity); // Optimistic
    try {
      await updateItemQuantityInCart(item.item_id || item.id, newQuantity);
    } catch (error) {
      setQuantity(quantity); // Revert
    }
  };

  const handleDecreaseQuantity = async () => {
    const newQuantity = quantity - 1;
    if (newQuantity > 0) {
      setQuantity(newQuantity); // Optimistic
      try {
        await updateItemQuantityInCart(item.item_id || item.id, newQuantity);
      } catch (error) {
        setQuantity(quantity); // Revert
      }
    } else {
      // If quantity becomes 0 or less, remove the item
      try {
        await removeItemFromCart(item.item_id || item.id);
        // No need to setQuantity(0) as item will disappear
      } catch (error) {
        // Revert if needed, though item might still be visually there until state updates
      }
    }
  };

  const handleRemove = async () => {
    try {
      await removeItemFromCart(item.item_id || item.id);
    } catch (error) {
      // Error handled by context
    }
  };

  const imageUrl = (item.product_image_urls && Array.isArray(item.product_image_urls) && item.product_image_urls.length > 0) 
                   ? item.product_image_urls[0].url 
                   : 'https://via.placeholder.com/50';

  return (
    <tr style={{ borderBottom: '1px solid #eee', opacity: isLoading ? 0.6 : 1 }}>
      <td style={{ padding: '10px' }}>
        <img src={imageUrl} alt={item.product_name || 'Product'} style={{ width: '50px', height: '50px', marginRight: '10px' }} />
        {item.product_name || 'Unknown Product'}
        <div style={{fontSize: '0.8em', color: '#666'}}>SKU: {item.product_sku || 'N/A'}</div>
      </td>
      <td style={{ padding: '10px', textAlign: 'right' }}>${parseFloat(item.price_at_addition || 0).toFixed(2)}</td>
      <td style={{ padding: '10px', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button onClick={handleDecreaseQuantity} disabled={isLoading} style={{margin: '0 5px'}}>-</button>
            <input 
                type="number" 
                value={quantity} 
                onChange={(e) => handleQuantityChange(e.target.value)} 
                disabled={isLoading}
                style={{ width: '50px', textAlign: 'center', margin: '0 5px' }}
                aria-label={`Quantity for ${item.product_name}`}
            />
            <button onClick={handleIncreaseQuantity} disabled={isLoading} style={{margin: '0 5px'}}>+</button>
        </div>
      </td>
      <td style={{ padding: '10px', textAlign: 'right' }}>${(parseFloat(item.price_at_addition || 0) * item.quantity).toFixed(2)}</td>
      <td style={{ padding: '10px', textAlign: 'center' }}>
        <button 
            onClick={handleRemove}
            disabled={isLoading}
            style={{color: 'red', background: 'none', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer'}}
            aria-label={`Remove ${item.product_name} from cart`}
        >
            {isLoading ? '...' : 'Remove'}
        </button>
      </td>
    </tr>
  );
};

export default CartItem;
