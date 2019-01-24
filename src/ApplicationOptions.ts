import {ClassTransformOptions} from "class-transformer";
import {ValidatorOptions} from "class-validator";

/**
 * Routing controller initialization options.
 */
export interface ApplicationOptions {

    /**
     * Indicates if cors are enabled.
     * This requires installation of additional module (cors for express and kcors for koa).
     */
    cors?: boolean | Object;

    /**
     * Global route prefix, for example '/api'.
     */
    routePrefix?: string;

    /**
     * List of controllers to register in the framework or directories from where to import all your controllers.
     */
    controllers?: Function[] | string[];

    /**
     * Indicates if class-transformer should be used to perform serialization / deserialization.
     */
    classTransformer?: boolean;

    /**
     * Global class transformer options passed to class-transformer during classToPlain operation.
     * This operation is being executed when server returns response to user.
     */
    classToPlainTransformOptions?: ClassTransformOptions;

    /**
     * Global class transformer options passed to class-transformer during plainToClass operation.
     * This operation is being executed when parsing user parameters.
     */
    plainToClassTransformOptions?: ClassTransformOptions;

    /**
     * Indicates if class-validator should be used to auto validate objects injected into params.
     * You can also directly pass validator options to enable validator with a given options.
     */
    validation?: boolean | ValidatorOptions;

    /**
     * Indicates if development mode is enabled.
     * By default its enabled if your NODE_ENV is not equal to "production".
     */
    development?: boolean;

    methodSeparator?: string;

    /**
     * Default settings
     */
    defaults?: {
        /**
         * If set, all null responses will return specified status code by default
         */
        nullResultCode?: number;

        /**
         * If set, all undefined responses will return specified status code by default
         */
        undefinedResultCode?: number;

        /**
         * Default param options
         */
        paramOptions?: {
            /**
             * If true, all non-set parameters will be required by default
             */
            required?: boolean;
        };
    };
}