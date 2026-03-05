export interface Problem {
  id: string;
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  is_bookmarked?: boolean;
  user_answer?: string;
  image_url?: string;
}

export interface ProblemSet {
  id: string;
  title: string;
  created_at?: string;
  has_images?: boolean;
}
