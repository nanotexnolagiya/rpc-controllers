import { MethodMetadata } from "../../metadata/MethodMetadata";
import { Method } from "../../Method";
import { ParamMetadata } from "../../metadata/ParamMetadata";
import { BaseDriver } from "../BaseDriver";
import { isPromiseLike } from "../../helpers/isPromiseLike";
import { getFromContainer } from "../../container";

/**
 * Integration with express framework.
 */
export class ExpressDriver extends BaseDriver {

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(public express?: any) {
        super();
        this.loadExpress();
        this.app = this.express;
    }

    // -------------------------------------------------------------------------
    // Public Methods
    // -------------------------------------------------------------------------

    /**
     * Initializes the things driver needs before routes and middlewares registration.
     */
    initialize() {
        if (this.cors) {
            const cors = require("cors");
            if (this.cors === true) {
                this.express.use(cors());
            } else {
                this.express.use(cors(this.cors));
            }
        }
    }

    /**
     * Registers action in the driver.
     */
    registerMethod(methodMetadata: MethodMetadata, executeCallback: (options: Method) => any): void {

        // middlewares required for this method
        const defaultMiddlewares: any[] = [];

        defaultMiddlewares.push(this.loadBodyParser().json(methodMetadata.bodyExtraOptions));

        // prepare route and route handler function
        const route = this.routePrefix + "*";
        const routeHandler = function routeHandler(request: any, response: any, next: Function) {
            // Express calls the "get" route automatically when we call the "head" route:
            // Reference: https://expressjs.com/en/4x/api.html#router.METHOD
            // This causes a double action execution on our side, which results in an unhandled rejection,
            // saying: "Can't set headers after they are sent".
            // The following line skips action processing when the request method does not match the action method.
            if (request.method.toLowerCase() !== methodMetadata.type)
                return next();

            return executeCallback({ request, response, next });
        };

        // finally register action in express
        this.express(...[
            route,
            ...defaultMiddlewares,
            routeHandler,
        ]);
    }

    /**
     * Registers all routes in the framework.
     */
    registerRoutes() {
    }

    /**
     * Gets param from the request.
     */
    getParamFromRequest(action: Method, param: ParamMetadata): any {
        const request: any = action.request;
        switch (param.type) {
            case "body":
                return request.body;

            case "body-param":
                return request.body[param.name];

            case "param":
                return request.params[param.name];

            case "params":
                return request.params;

            case "session":
                if (param.name)
                    return request.session[param.name];

                return request.session;

            case "state":
                throw new Error("@State decorators are not supported by express driver.");

            case "query":
                return request.query[param.name];

            case "queries":
                return request.query;

            case "header":
                return request.headers[param.name.toLowerCase()];

            case "headers":
                return request.headers;

            case "file":
                return request.file;

            case "files":
                return request.files;
        }
    }

    /**
     * Handles result of successfully executed controller action.
     */
    handleSuccess(result: any, method: MethodMetadata, options: Method): void {

        // if the method returned the response object itself, short-circuits
        if (result && result === options.response) {
            options.next();
            return;
        }

        // transform result if needed
        result = this.transformResult(result, method, options);

        // set http status code
        if (result === undefined && method.undefinedResultCode) {
            if (method.undefinedResultCode instanceof Function) {
                throw new (method.undefinedResultCode as any)(options);
            }
            options.response.status(method.undefinedResultCode);
        }
        else if (result === null) {
            if (method.nullResultCode) {
                if (method.nullResultCode instanceof Function) {
                    throw new (method.nullResultCode as any)(options);
                }
                options.response.status(method.nullResultCode);
            } else {
                options.response.status(204);
            }
        }
        else if (method.successHttpCode) {
            options.response.status(method.successHttpCode);
        }

        // apply http headers
        Object.keys(method.headers).forEach(name => {
            options.response.header(name, method.headers[name]);
        });

        if (result === undefined) { // throw NotFoundError on undefined response
            // todo send error
            if (method.undefinedResultCode) {

                options.next();

            } else {
                // throw new NotFoundError();
            }
        } else if (result === null) { // send null response
            // todo send null response
            options.next();
        } else if (result instanceof Buffer) { // check if it's binary data (Buffer)
            options.response.end(result, "binary");
        }
        else if (result instanceof Uint8Array) { // check if it's binary data (typed array)
            options.response.end(Buffer.from(result as any), "binary");
        }
        else if (result.pipe instanceof Function) {
            result.pipe(options.response);
        }
        else { // send regular result
            if (method) {
                options.response.json(result);
            } else {
                options.response.send(result);
            }
            options.next();
        }
    }

    /**
     * Handles result of failed executed controller method.
     */
    handleError(error: any, method: MethodMetadata | undefined, options: Method): any {
        if (this.isDefaultErrorHandlingEnabled) {
            const response: any = options.response;

            // set http code
            // note that we can't use error instanceof HttpError properly anymore because of new typescript emit process
            if (error.httpCode) {
                response.status(error.httpCode);
            } else {
                response.status(500);
            }

            // apply http headers
            if (method) {
                Object.keys(method.headers).forEach(name => {
                    response.header(name, method.headers[name]);
                });
            }

            // send error content
            response.json(this.processJsonError(error));
        }
        options.next(error);
    }

    /**
     * Dynamically loads express module.
     */
    protected loadExpress() {
        if (require) {
            if (!this.express) {
                try {
                    this.express = require("express")();
                } catch (e) {
                    throw new Error("express package was not found installed. Try to install it: npm install express --save");
                }
            }
        } else {
            throw new Error("Cannot load express. Try to install all required dependencies.");
        }
    }

    /**
     * Dynamically loads body-parser module.
     */
    protected loadBodyParser() {
        try {
            return require("body-parser");
        } catch (e) {
            throw new Error("body-parser package was not found installed. Try to install it: npm install body-parser --save");
        }
    }

}
