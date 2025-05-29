import React from 'react';
import { Link } from 'react-router-dom';

const CourseCard = ({ course }) => {
  const cardStyle = {
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    overflow: 'hidden', // To contain image border radius
    margin: '15px',
    width: 'calc(33.333% - 32px)', // For 3 cards per row, accounting for margin. Adjust as needed.
    boxSizing: 'border-box',
    boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
    display: 'flex',
    flexDirection: 'column',
    transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
    // Basic hover effect:
    // '&:hover': {
    //   transform: 'translateY(-5px)',
    //   boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
    // } // Note: This pseudo-selector won't work in inline styles. Needs CSS/JSS.
  };

  const imageContainerStyle = {
    width: '100%',
    height: '180px', // Fixed height for image container
    backgroundColor: '#f0f0f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  };

  const imageStyle = {
    width: '100%',
    height: '100%',
    objectFit: 'cover', // Ensures image covers the area, might crop
  };

  const contentStyle = {
    padding: '15px',
    flexGrow: 1, // Allows content to take available space
    display: 'flex',
    flexDirection: 'column',
  };

  const titleStyle = {
    fontSize: '1.25rem',
    fontWeight: 'bold',
    marginBottom: '8px',
    minHeight: '3em', // Approx 2 lines with 1.25rem font
    lineHeight: '1.4em',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  };

  const descriptionStyle = {
    fontSize: '0.9rem',
    color: '#555',
    marginBottom: '12px',
    flexGrow: 1, // Pushes elements below it down
    minHeight: '4.5em', // Approx 3-4 lines
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 3, 
    WebkitBoxOrient: 'vertical',
  };

  const instructorStyle = {
    fontSize: '0.85rem',
    color: '#777',
    marginBottom: '8px',
  };

  const priceStyle = {
    fontSize: '1.1rem',
    fontWeight: 'bold',
    color: '#333',
    marginBottom: '15px',
  };

  const linkStyle = {
    textDecoration: 'none',
    color: 'white',
    backgroundColor: '#007bff',
    fontWeight: 'bold',
    display: 'block',
    textAlign: 'center',
    padding: '10px 15px',
    borderRadius: '5px',
    marginTop: 'auto', // Pushes button to bottom if card content is shorter
    transition: 'background-color 0.2s ease',
  };

  // Placeholder image if course.cover_image_url is not available
  const coverImage = course.cover_image_url || 'https://via.placeholder.com/300x180.png?text=Course+Image';
  
  // Display price or "Free"
  // The API GET /api/courses/published returns `course_price` directly
  const displayPrice = course.course_price !== undefined && course.course_price !== null 
    ? `$${parseFloat(course.course_price).toFixed(2)}` 
    : 'Free';

  return (
    <div style={cardStyle} className="course-card-hover"> {/* Add className for CSS hover effects */}
      <Link to={`/courses/${course.slug}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', height: '100%'}}>
        <div style={imageContainerStyle}>
          <img src={coverImage} alt={course.title} style={imageStyle} />
        </div>
        <div style={contentStyle}>
          <div>
            <h3 style={titleStyle}>{course.title || 'Untitled Course'}</h3>
            <p style={descriptionStyle}>{course.description || 'No description available.'}</p>
            {course.instructor_name && <p style={instructorStyle}>By: {course.instructor_name}</p>}
          </div>
          <p style={priceStyle}>{displayPrice}</p>
        </div>
      </Link>
      {/* The Link now wraps most of the card, if you want a button at the bottom for navigation instead: */}
      {/* <div style={{padding: '0 15px 15px 15px'}}>
           <Link to={`/courses/${course.slug}`} style={linkStyle}>View Details</Link>
         </div> */}
    </div>
  );
};

// Add some global CSS for hover effects if possible, or use a CSS-in-JS solution
// For example, in your main CSS file:
// .course-card-hover:hover {
//   transform: translateY(-5px);
//   box-shadow: 0 8px 16px rgba(0,0,0,0.2);
// }

export default CourseCard;
