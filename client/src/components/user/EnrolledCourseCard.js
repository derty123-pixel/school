import React from 'react';
import { Link } from 'react-router-dom';

const EnrolledCourseCard = ({ course }) => {
  // Styles are similar to CourseCard, can be refactored into a common style object or CSS classes
  const cardStyle = {
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    overflow: 'hidden',
    margin: '15px',
    width: 'calc(33.333% - 32px)', // For 3 cards per row
    boxSizing: 'border-box',
    boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
    display: 'flex',
    flexDirection: 'column',
    // Basic hover effect (better with CSS classes)
    // '&:hover': { transform: 'translateY(-5px)', boxShadow: '0 8px 16px rgba(0,0,0,0.2)' },
  };

  const imageContainerStyle = {
    width: '100%',
    height: '180px',
    backgroundColor: '#f0f0f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  };

  const imageStyle = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  };

  const contentStyle = {
    padding: '15px',
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
  };

  const titleStyle = {
    fontSize: '1.25rem',
    fontWeight: 'bold',
    marginBottom: '8px',
    minHeight: '3em', 
    lineHeight: '1.4em',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  };

  const instructorStyle = {
    fontSize: '0.85rem',
    color: '#777',
    marginBottom: '10px',
  };

  const progressContainerStyle = {
    width: '100%',
    backgroundColor: '#e9ecef',
    borderRadius: '4px',
    margin: '10px 0',
    height: '22px',
    overflow: 'hidden',
  };

  const progressBarStyle = {
    width: `${course.progress_percent || 0}%`,
    backgroundColor: '#28a745',
    height: '100%',
    lineHeight: '22px', // Vertically center text
    color: 'white',
    textAlign: 'center',
    fontSize: '0.8em',
    transition: 'width 0.5s ease-in-out',
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
    marginTop: 'auto', // Pushes button to bottom
    transition: 'background-color 0.2s ease',
  };

  const coverImage = course.cover_image_url || 'https://via.placeholder.com/300x180.png?text=Course+Image';

  // Determine the link to the learning page
  // Backend API for enrolled courses returns `last_accessed_lesson_id`
  // If not available, link to the course overview page or a conceptual first lesson.
  // The actual first lesson ID would ideally come from the course structure data.
  // For MVP, we'll link to a general course learning page if no last_accessed_lesson_id.
  let learnLink = `/learn/${course.id}`; // Fallback to general course learning page
  if (course.last_accessed_lesson_id) {
    learnLink = `/learn/${course.id}/lessons/${course.last_accessed_lesson_id}`;
  } else {
    // If no last_accessed_lesson_id, you might want to fetch the course structure
    // to find the first lesson ID. This is an optimization for later.
    // For now, `/learn/${course.id}` can be a page that lists modules/lessons or redirects to first lesson.
  }

  let buttonText = 'Start Learning';
  if (course.progress_percent > 0 && course.progress_percent < 100) {
    buttonText = 'Continue Learning';
  } else if (course.progress_percent === 100) {
    buttonText = 'Review Course';
  }

  return (
    <div style={cardStyle} className="enrolled-course-card-hover">
      <div style={imageContainerStyle}>
        <img src={coverImage} alt={course.title} style={imageStyle} />
      </div>
      <div style={contentStyle}>
        <div>
          <h3 style={titleStyle}>{course.title || 'Untitled Course'}</h3>
          {course.instructor_name && <p style={instructorStyle}>By: {course.instructor_name}</p>}
          <div style={{ marginTop: 'auto' }}> {/* Pushes progress and button down */}
            <p style={{fontSize: '0.9em', marginBottom: '5px'}}>Progress:</p>
            <div style={progressContainerStyle} title={`Progress: ${course.progress_percent || 0}%`}>
              <div style={progressBarStyle}>
                {course.progress_percent || 0}%
              </div>
            </div>
          </div>
        </div>
        <Link to={learnLink} style={linkStyle}>
          {buttonText}
        </Link>
      </div>
    </div>
  );
};

export default EnrolledCourseCard;
