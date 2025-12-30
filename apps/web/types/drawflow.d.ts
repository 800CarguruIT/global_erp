declare module "drawflow" {
  export default class Drawflow {
    constructor(container: HTMLElement);
    reroute: boolean;
    editor_mode: string;
    start(): void;
    export(): unknown;
    import(data: unknown): void;
    updateNodeDataFromId(id: number, data: Record<string, unknown>): void;
    drawflow: any;
    addNode(
      name: string,
      inputs: number,
      outputs: number,
      pos_x: number,
      pos_y: number,
      className: string,
      data: Record<string, unknown>,
      html: string
    ): number;
    addConnection(outputId: number, inputId: number, outputClass: string, inputClass: string): void;
  }
}
