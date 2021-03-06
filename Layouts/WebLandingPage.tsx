
import { React, LayoutComponent, ContentComponent, DOMElement } from '../Library/Index';

interface Regions {
    Header: new(props: any, children: any) => ContentComponent<any, any, any>;
    Body: new(props: any, children: any) => ContentComponent<any, any, any>;
    Overlay: new(props: any, children: any) => ContentComponent<any, any, any>;
}

interface LayoutElements {
    canvasWave: DOMElement;
}

class Gaussian {
    public standardDeviation: number;

    constructor(public mean: number, public variance: number) {
        this.standardDeviation = Math.sqrt(variance);
    }

    pdf(x: number) {
        var m = this.standardDeviation * Math.sqrt(2 * Math.PI);
        var e = Math.exp(-Math.pow(x - this.mean, 2) / (2 * this.variance));
        return e / m;
    }
}

let requestAnimationFrame: typeof window.requestAnimationFrame = (() => {
    if (typeof window !== 'undefined') {
        return function(callback: Function) {
            return setTimeout(callback, 1000 / 30);
        }
    }
})();

let cancelAnimationFrame = (() => {
    if (typeof window !== 'undefined') {
        return function(id: number) {
            clearTimeout(id);
        }
    }
})();

interface Point {
    x: number;
    y: number;
}

class SineWave {
    public startPoint: Point;
    public offset: Point;
    public period = 500;
    public amplitude = 100;
    public gaussian: Gaussian;
    public context: CanvasRenderingContext2D;
    public animation: any;

    constructor(public canvas: HTMLCanvasElement, width: number, height: number) {
        this.startPoint = { x: 0, y: 0 };
        canvas.width = width * 2;
        canvas.height = height * 2;
        this.gaussian = new Gaussian(canvas.width / 4, canvas.width * 70);
        this.canvas = canvas;
        this.context = this.canvas.getContext('2d');
        this.context.scale(2, 2);
        this.context.lineWidth = 4;
        this.offset = { x: 0, y: height / 2 };
    }

    /**
     * Get y coordinate based on x
     */
    private getYCoordinate(x: number, line: number): number {
        let period: number;
        let xWithOffset = (x + this.offset.x);
        switch (line) {
            case 2:
                xWithOffset += 100;
                break;
            case 3:
                xWithOffset += 200;
                break;
        }
        let y = this.amplitude * Math.sin(1 * Math.PI / this.period * xWithOffset);
        return ((y - (line * 60)) * this.gaussian.pdf(x) * this.canvas.height * 0.6 + this.offset.y);
    }

    /**
    * Start animate the sinus wave
    */
    start() {
        let lastAnimation = new Date().getTime()

        let _this = this;
        function animate() {
            _this.context.clearRect(0, 0, _this.canvas.width, _this.canvas.height);

            _this.offset.x += 0.4 * (new Date().getTime() - lastAnimation) / 16;
            if(_this.offset.x >= _this.canvas.width) {
                _this.offset.x = _this.offset.x - 2 * Math.PI/_this.period;
            }

            for(var line = 1; line <= 3; line++) {
                _this.context.beginPath();
                _this.context.strokeStyle = '#FAFAFC';

                _this.context.moveTo(_this.startPoint.x, _this.startPoint.y);
                for(var index = 1; index <= _this.canvas.width; index++) {
                    let newX = _this.startPoint.x + index;
                    _this.context.lineTo(newX, _this.getYCoordinate(newX, line));
                }
                _this.context.stroke();
            }

            lastAnimation = new Date().getTime();


            // _this.animation = requestAnimationFrame(animate);
        }
        this.animation = requestAnimationFrame(animate);
    };

    /**
     * Stop canvas rendering.
     */
    stop() {
        cancelAnimationFrame(this.animation);
    };
}

export class WebLandingPage extends LayoutComponent<Regions, {}, LayoutElements> {
    public render() {
        return (
            <div class={'FillParentLayout BgLightGrey' + (inServer ? ' Final' : ' Ingoing')}>
                <header id='Header'>
                    {this.props.Header}
                </header>
                <section id='Body'>
                    {this.props.Body}
                </section>
                <canvas ref='canvasWave' id='CanvasWave'></canvas>
            </div>
        );
    }

    public bindDOM() {
        super.bindDOM();
        if(!cf.IN_IMAGE_TEST) {
            let canvas = this.elements.canvasWave;
            let sinusWave = new SineWave(this.elements.canvasWave.nativeElement as HTMLCanvasElement, canvas.getWidth(), canvas.getHeight());
            sinusWave.start();
        }
    }

    public onRemove(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.root.addClass('Outgoing').removeClass('Final')
                .onTransitionEnd(() => {
                    resolve();
                    super.onRemove();
                });
        });
    }
}