
export interface Subtitle {
  id: number;
  text: string;
  startTime: number;
  endTime: number;
}

export interface CustomizationState {
  fontSize: number;
  color: string;
  fontFamily: string;
  position: { x: number; y: number };
  backgroundColor: string;
}
