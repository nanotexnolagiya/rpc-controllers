import {classToPlain, ClassTransformOptions} from "class-transformer";

import {MethodMetadata} from "../metadata/MethodMetadata";
import {ParamMetadata} from "../metadata/ParamMetadata";
import {Action} from "../Action";
import {RpcError} from "../rpc-error/RpcError";
import {InternalError} from "../rpc-error/InternalError";
import {ServerError} from "../rpc-error/ServerError";

/**
 * Base driver functionality for all other drivers.
 * Abstract layer to organize controllers integration with different http server implementations.
 */
export abstract class BaseDriver {

    /**
     * Reference to the underlying framework app object.
     */
    app: any;

    /**
     * Indicates if class-transformer should be used or not.
     */
    useClassTransformer: boolean;

    /**
     * Global class transformer options passed to class-transformer during classToPlain operation.
     * This operation is being executed when server returns response to user.
     */
    classToPlainTransformOptions: ClassTransformOptions;

    /**
     * Global class transformer options passed to class-transformer during plainToClass operation.
     * This operation is being executed when parsing user parameters.
     */
    plainToClassTransformOptions: ClassTransformOptions;

    /**
     * Indicates if default routing-controllers error handler should be used or not.
     */
    isDefaultErrorHandlingEnabled: boolean;

    /**
     * Indicates if routing-controllers should operate in development mode.
     */
    developmentMode: boolean;

    /**
     * Global application prefix.
     */
    routePrefix: string = "";

    /**
     * Indicates if cors are enabled.
     * This requires installation of additional module (cors for express and kcors for koa).
     */
    cors?: boolean | Object;

    /**
     * Initializes the things driver needs before routes and middleware registration.
     */
    abstract initialize(): void;

    /**
     * Registers method in the driver.
     */
    abstract registerMethod(methods: MethodMetadata[], executeCallback: (error: any, action: Action, method?: MethodMetadata) => any): void;

    /**
     * Registers all routes in the framework.
     */
    abstract registerRoutes(): void;

    /**
     * Gets param from the request.
     */
    abstract getParamFromRequest(methodOptions: Action, param: ParamMetadata): any;

    /**
     * Defines an algorithm of how to handle error during executing controller method.
     */
    abstract handleError(error: any, action: Action): any;

    /**
     * Defines an algorithm of how to handle success result of executing controller method.
     */
    abstract handleSuccess(result: any, method: MethodMetadata, action: Action): void;

    // -------------------------------------------------------------------------
    // Protected Methods
    // -------------------------------------------------------------------------

    protected transformResult(result: any, method: MethodMetadata, action: Action): any {
        // check if we need to transform result
        const shouldTransform = (this.useClassTransformer && result != null) // transform only if enabled and value exist
            && result instanceof Object // don't transform primitive types (string/number/boolean)
            && !(
                result instanceof Uint8Array // don't transform binary data
                ||
                result.pipe instanceof Function // don't transform streams
            );

        // transform result if needed
        if (shouldTransform) {
            const action = method.responseClassTransformOptions || this.classToPlainTransformOptions;
            result = classToPlain(result, action);
        } else if (result instanceof Buffer || result instanceof Uint8Array) { // check if it's binary data (typed array)
            result = new Buffer(result as any).toString("binary");
        } else if (result.pipe instanceof Function) {
            result.pipe(action.response);
        }

        return result;
    }

    protected processJsonError(error: any) {

        let processedError: any = {};
        if (error instanceof RpcError) {
            processedError.code = error.rpcCode;

            if (error.message)
                processedError.message = error.message;

            processedError.data = {};
            if (error.stack && this.developmentMode)
                processedError.data.stack = error.stack;

            Object.keys(error)
                .filter(key => key !== "stack" && key !== "name" && key !== "message" && key !== "rpcCode")
                .forEach(key => processedError.data[key] = (error as any)[key]);

        } else if (typeof error === "string") {
            error = new InternalError(error);
            processedError.code = error.rpcCode;

            if (error.message)
                processedError.message = error.message;

            processedError.data = {};
            if (error.stack && this.developmentMode)
                processedError.data.stack = error.stack;

            Object.keys(error)
                .filter(key => key !== "stack" && key !== "name" && key !== "message" && key !== "rpcCode")
                .forEach(key => processedError.data[key] = (error as any)[key]);

        } else {
            processedError.code = new ServerError().rpcCode;

            if (error.message)
                processedError.message = error.message;

            processedError.data = {};
            if (error.stack && this.developmentMode)
                processedError.data.stack = error.stack;

            Object.keys(error)
                .filter(key => key !== "stack" && key !== "name" && key !== "message" && key !== "rpcCode")
                .forEach(key => processedError.data[key] = (error as any)[key]);

        }

        return Object.keys(processedError).length > 0 ? processedError : undefined;
    }

    protected merge(obj1: any, obj2: any): any {
        const result: any = {};
        for (let i in obj1) {
            if ((i in obj2) && (typeof obj1[i] === "object") && (i !== null)) {
                result[i] = this.merge(obj1[i], obj2[i]);
            } else {
                result[i] = obj1[i];
            }
        }
        for (let i in obj2) {
            result[i] = obj2[i];
        }
        return result;
    }

}
