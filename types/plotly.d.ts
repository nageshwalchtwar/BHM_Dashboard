declare module 'react-plotly.js' {
  import { Component } from 'react';
  
  interface PlotParams {
    data: any[];
    layout?: any;
    config?: any;
    style?: React.CSSProperties;
    useResizeHandler?: boolean;
    onInitialized?: (figure: any, graphDiv: any) => void;
    onUpdate?: (figure: any, graphDiv: any) => void;
    onRelayout?: (event: any) => void;
    onClick?: (event: any) => void;
    onHover?: (event: any) => void;
    onSelected?: (event: any) => void;
  }
  
  class Plot extends Component<PlotParams> {}
  export default Plot;
}

declare module 'plotly.js-dist-min' {
  const Plotly: any;
  export default Plotly;
}
