export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-4xl font-bold mb-6">About Little PAIPer</h1>
      
      <h2 className="text-2xl font-semibold mb-3 mt-6">What is Little PAIPer?</h2>
      <p className="text-lg text-gray-700 mb-4">
        Little PAIPer is an interactive learning platform that transforms educational materials—from 
        YouTube videos to Jupyter notebooks—into personalized Socratic dialogues. Using pedagogical 
        concept graphs and AI-guided conversations, it helps learners master complex technical topics 
        through active engagement and adaptive feedback.
      </p>

      <h2 className="text-2xl font-semibold mb-3 mt-6">The Name</h2>
      <p className="text-lg text-gray-700 mb-4">
        "Little PAIPer" is a portmanteau of two beloved works:{" "}
        <a
          href="https://mitpress.mit.edu/9780262560993/the-little-schemer/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          <em>The Little Schemer</em>
        </a>
        , the classic programming book known for its question-and-answer teaching style, and{" "}
        <a
          href="https://github.com/norvig/paip-lisp"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          <em>Paradigms of Artificial Intelligence Programming</em> (PAIP)
        </a>
        , Peter Norvig's comprehensive guide to AI techniques.
      </p>
      <p className="text-lg text-gray-700 mb-4">
        The name reflects our pedagogical approach: combining the incremental, Socratic questioning 
        of <em>The Little Schemer</em> with the depth and rigor of AI concepts from PAIP. This fusion 
        has personal significance to the creators—both deeply influenced by <em>The Little Schemer</em>'s 
        teaching philosophy, and Peter Norvig holds the copyright to PAIP, which was reassigned to him 
        by the publisher.
      </p>

      <h2 className="text-2xl font-semibold mb-3 mt-6">How It Works</h2>
      <p className="text-lg text-gray-700 mb-4">
        Little PAIPer automatically extracts a <strong>pedagogical concept graph</strong> from any 
        educational source—identifying key concepts, their prerequisites, and mastery criteria. As you 
        learn, an AI tutor guides you through concepts in optimal order, asking questions, providing 
        hints, and seamlessly transitioning between topics as you demonstrate understanding.
      </p>
      <p className="text-lg text-gray-700 mb-4">
        The platform features interactive Python environments, progress tracking, and adaptive pacing 
        that responds to your individual learning style. Whether you're exploring machine learning 
        algorithms, data structures, or advanced AI techniques, Little PAIPer makes learning feel like 
        a conversation with a patient, knowledgeable mentor.
      </p>

      <h2 className="text-2xl font-semibold mb-3 mt-6">Created By</h2>
      <p className="text-lg text-gray-700 mb-4">
        Little PAIPer was created by <strong>Peter Norvig</strong> and <strong>Peter Danenberg</strong> 
        as an exploration of AI-assisted education and knowledge representation. The project combines 
        decades of teaching experience with modern language models to create a new kind of interactive 
        learning experience.
      </p>

      <div className="mt-8 text-gray-600 text-sm">
        <p>
          For more information, please refer to the{" "}
          <a
            href="https://github.com/google-gemini/workshops/tree/main/learning"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            project repository on GitHub
          </a>
          .
        </p>
      </div>
    </div>
  );
}
