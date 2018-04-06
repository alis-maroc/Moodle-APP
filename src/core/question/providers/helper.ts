// (C) Copyright 2015 Martin Dougiamas
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Injectable, EventEmitter } from '@angular/core';
import { CoreDomUtilsProvider } from '@providers/utils/dom';
import { CoreTextUtilsProvider } from '@providers/utils/text';
import { CoreQuestionProvider } from './question';

/**
 * Service with some common functions to handle questions.
 */
@Injectable()
export class CoreQuestionHelperProvider {
    protected lastErrorShown = 0;
    protected div = document.createElement('div'); // A div element to search in HTML code.

    constructor(private domUtils: CoreDomUtilsProvider, private textUtils: CoreTextUtilsProvider,
        private questionProvider: CoreQuestionProvider) { }

    /**
     * Add a behaviour button to the question's "behaviourButtons" property.
     *
     * @param {any} question Question.
     * @param {HTMLInputElement} button Behaviour button (DOM element).
     */
    protected addBehaviourButton(question: any, button: HTMLInputElement): void {
        if (!button || !question) {
            return;
        }

        if (!question.behaviourButtons) {
            question.behaviourButtons = [];
        }

        // Extract the data we want.
        question.behaviourButtons.push({
            id: button.id,
            name: button.name,
            value: button.value,
            disabled: button.disabled
        });
    }

    /**
     * Check if the question has a redo button and, if so, add it to "behaviourButtons" property
     * and remove it from the HTML.
     *
     * @param {any} question Question to treat.
     */
    extractQbehaviourRedoButton(question: any): void {
        // Create a fake div element so we can search using querySelector.
        const redoSelector = 'input[type="submit"][name*=redoslot], input[type="submit"][name*=tryagain]';

        // Search redo button in feedback.
        if (!this.searchBehaviourButton(question, 'html', '.outcome ' + redoSelector)) {
            // Not found in question HTML.
            if (question.feedbackHtml) {
                // We extracted the feedback already, search it in there.
                if (this.searchBehaviourButton(question, 'feedbackHtml', redoSelector)) {
                    // Button found, stop.
                    return;
                }
            }

            // Button still not found. Now search in the info box if it exists.
            if (question.infoHtml) {
                this.searchBehaviourButton(question, 'infoHtml', redoSelector);
            }
        }
    }

    /**
     * Removes the comment from the question HTML code and adds it in a new "commentHtml" property.
     *
     * @param {any} question Question.
     */
    extractQuestionComment(question: any): void {
        this.extractQuestionLastElementNotInContent(question, '.comment', 'commentHtml');
    }

    /**
     * Removes the feedback from the question HTML code and adds it in a new "feedbackHtml" property.
     *
     * @param {any} question Question.
     */
    extractQuestionFeedback(question: any): void {
        this.extractQuestionLastElementNotInContent(question, '.outcome', 'feedbackHtml');
    }

    /**
     * Extracts the info box from a question and add it to an "infoHtml" property.
     *
     * @param {any} question Question.
     * @param {string} selector Selector to search the element.
     */
    extractQuestionInfoBox(question: any, selector: string): void {
        this.extractQuestionLastElementNotInContent(question, selector, 'infoHtml');
    }

    /**
     * Searches the last occurrence of a certain element and check it's not in the question contents.
     * If found, removes it from the question HTML and adds it to a new property inside question.
     *
     * @param {any} question Question.
     * @param {string} selector Selector to search the element.
     * @param {string} attrName Name of the attribute to store the HTML in.
     */
    protected extractQuestionLastElementNotInContent(question: any, selector: string, attrName: string): void {
        this.div.innerHTML = question.html;

        const matches = <HTMLElement[]> Array.from(this.div.querySelectorAll(selector));

        // Get the last element and check it's not in the question contents.
        let last = matches.pop();
        while (last) {
            if (!this.domUtils.closest(last, '.formulation')) {
                // Not in question contents. Add it to a separate attribute and remove it from the HTML.
                question[attrName] = last.innerHTML;
                last.parentElement.removeChild(last);
                question.html = this.div.innerHTML;

                return;
            }

            // It's inside the question content, treat next element.
            last = matches.pop();
        }
    }

    /**
     * Removes the scripts from a question's HTML and adds it in a new 'scriptsCode' property.
     * It will also search for init_question functions of the question type and add the object to an 'initObjects' property.
     *
     * @param {any} question Question.
     */
    extractQuestionScripts(question: any): void {
        question.scriptsCode = '';
        question.initObjects = [];

        if (question.html) {
            // Search the scripts.
            const matches = question.html.match(/<script[^>]*>[\s\S]*?<\/script>/mg);
            if (!matches) {
                // No scripts, stop.
                return;
            }

            matches.forEach((match: string) => {
                // Add the script to scriptsCode and remove it from html.
                question.scriptsCode += match;
                question.html = question.html.replace(match, '');

                // Search init_question functions for this type.
                const initMatches = match.match(new RegExp('M\.qtype_' + question.type + '\.init_question\\(.*?}\\);', 'mg'));
                if (initMatches) {
                    let initMatch = initMatches.pop();

                    // Remove start and end of the match, we only want the object.
                    initMatch = initMatch.replace('M.qtype_' + question.type + '.init_question(', '');
                    initMatch = initMatch.substr(0, initMatch.length - 2);

                    // Try to convert it to an object and add it to the question.
                    question.initObjects = this.textUtils.parseJSON(initMatch);
                }
            });
        }
    }

    /**
     * Get the sequence check from a question HTML.
     *
     * @param {string} html Question's HTML.
     * @return {{name: string, value: string}} Object with the sequencecheck name and value.
     */
    getQuestionSequenceCheckFromHtml(html: string): {name: string, value: string} {
        if (html) {
            this.div.innerHTML = html;

            // Search the input holding the sequencecheck.
            const input = <HTMLInputElement> this.div.querySelector('input[name*=sequencecheck]');
            if (input && typeof input.name != 'undefined' && typeof input.value != 'undefined') {
                return {
                    name: input.name,
                    value: input.value
                };
            }
        }
    }

    /**
     * Get the validation error message from a question HTML if it's there.
     *
     * @param {string} html Question's HTML.
     * @return {string} Validation error message if present.
     */
    getValidationErrorFromHtml(html: string): string {
        this.div.innerHTML = html;

        return this.domUtils.getContentsOfElement(this.div, '.validationerror');
    }

    /**
     * For each input element found in the HTML, search if there's a local answer stored and
     * override the HTML's value with the local one.
     *
     * @param {any} question Question.
     */
    loadLocalAnswersInHtml(question: any): void {
        const form = document.createElement('form');
        form.innerHTML = question.html;

        // Search all input elements.
        Array.from(form.elements).forEach((element: HTMLInputElement | HTMLButtonElement) => {
            let name = element.name || '';
            // Ignore flag and submit inputs.
            if (!name || name.match(/_:flagged$/) || element.type == 'submit' || element.tagName == 'BUTTON') {
                return;
            }

            // Search if there's a local answer.
            name = this.questionProvider.removeQuestionPrefix(name);
            if (question.localAnswers && typeof question.localAnswers[name] != 'undefined') {

                if (element.tagName == 'TEXTAREA') {
                    // Just put the answer inside the textarea.
                    element.innerHTML = question.localAnswers[name];
                } else if (element.tagName == 'SELECT') {
                    // Search the selected option and select it.
                    const selected = element.querySelector('option[value="' + question.localAnswers[name] + '"]');
                    if (selected) {
                        selected.setAttribute('selected', 'selected');
                    }
                } else if (element.type == 'radio' || element.type == 'checkbox') {
                    // Check if this radio or checkbox is selected.
                    if (element.value == question.localAnswers[name]) {
                        element.setAttribute('checked', 'checked');
                    }
                } else {
                    // Put the answer in the value.
                    element.setAttribute('value', question.localAnswers[name]);
                }
            }
        });

        // Update the question HTML.
        question.html = form.innerHTML;
    }

    /**
     * Search a behaviour button in a certain question property containing HTML.
     *
     * @param {any} question Question.
     * @param {string} htmlProperty The name of the property containing the HTML to search.
     * @param {string} selector The selector to find the button.
     * @return {boolean} Whether the button is found.
     */
    protected searchBehaviourButton(question: any, htmlProperty: string, selector: string): boolean {
        this.div.innerHTML = question[htmlProperty];

        const button = <HTMLInputElement> this.div.querySelector(selector);
        if (button) {
            // Add a behaviour button to the question's "behaviourButtons" property.
            this.addBehaviourButton(question, button);

            // Remove the button from the HTML.
            button.parentElement.removeChild(button);

            // Update the question's html.
            question[htmlProperty] = this.div.innerHTML;

            return true;
        }

        return false;
    }

    /**
     * Convenience function to show a parsing error and abort.
     *
     * @param {EventEmitter<void>} [onAbort] If supplied, will emit an event.
     * @param {string} [error] Error to show.
     */
    showComponentError(onAbort: EventEmitter<void>, error?: string): void {
        error = error || 'Error processing the question. This could be caused by custom modifications in your site.';

        // Prevent consecutive errors.
        const now = Date.now();
        if (now - this.lastErrorShown > 500) {
            this.lastErrorShown = now;
            this.domUtils.showErrorModal(error);
        }

        onAbort && onAbort.emit();
    }
}