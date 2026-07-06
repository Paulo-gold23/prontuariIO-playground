/**
 * js/shared/cpf-validator.js
 * ─────────────────────────────────────────────────────────────
 * Responsabilidade: máscara em tempo real e validação matemática de CPF.
 * Puro JS Vanilla — sem dependências.
 */

(function () {
    'use strict';

    /**
     * Valida um CPF utilizando o algoritmo oficial de dígitos verificadores.
     * @param {string} cpf - CPF com ou sem formatação
     * @returns {boolean} True se for válido
     */
    function validar(cpf) {
        if (!cpf) return false;
        
        var limpo = (cpf || '').replace(/\D/g, '');
        
        if (limpo.length !== 11) return false;
        
        // Ignora CPFs conhecidos de dígitos repetidos
        if (/^(\d)\1{10}$/.test(limpo)) return false;
        
        // Validação do primeiro dígito verificador
        var soma = 0;
        for (var i = 0; i < 9; i++) {
            soma += parseInt(limpo.charAt(i), 10) * (10 - i);
        }
        var resto = (soma * 10) % 11;
        if (resto === 10 || resto === 11) resto = 0;
        if (resto !== parseInt(limpo.charAt(9), 10)) return false;
        
        // Validação do segundo dígito verificador
        soma = 0;
        for (var i = 0; i < 10; i++) {
            soma += parseInt(limpo.charAt(i), 10) * (11 - i);
        }
        resto = (soma * 10) % 11;
        if (resto === 10 || resto === 11) resto = 0;
        if (resto !== parseInt(limpo.charAt(10), 10)) return false;
        
        return true;
    }

    /**
     * Formata um CPF em tempo real (máscara ###.###.###-##).
     * @param {string} cpf - CPF limpo ou parcialmente formatado
     * @returns {string} CPF formatado
     */
    function formatar(cpf) {
        var limpo = (cpf || '').replace(/\D/g, '');
        if (limpo.length > 11) limpo = limpo.substring(0, 11);
        
        var m = limpo;
        if (m.length > 9) {
            return m.substring(0, 3) + '.' + m.substring(3, 6) + '.' + m.substring(6, 9) + '-' + m.substring(9);
        } else if (m.length > 6) {
            return m.substring(0, 3) + '.' + m.substring(3, 6) + '.' + m.substring(6);
        } else if (m.length > 3) {
            return m.substring(0, 3) + '.' + m.substring(3);
        }
        return m;
    }

    /**
     * Remove formatação retornando apenas dígitos.
     * @param {string} str 
     * @returns {string}
     */
    function limpar(str) {
        return (str || '').replace(/\D/g, '');
    }

    /**
     * Vincula listeners de digitação a um input para aplicar a máscara.
     * @param {HTMLInputElement} inputEl 
     */
    function aplicarMascara(inputEl) {
        if (!inputEl) return;
        inputEl.addEventListener('input', function (e) {
            var cursor = e.target.selectionStart;
            var valorOriginal = e.target.value;
            var limpo = limpar(valorOriginal);
            var formatado = formatar(limpo);
            e.target.value = formatado;
            
            // Corrige cursor para edições no meio do input
            if (cursor !== null && valorOriginal.length !== formatado.length) {
                var diff = formatado.length - valorOriginal.length;
                e.target.setSelectionRange(cursor + diff, cursor + diff);
            }
        });
    }

    window.CPFValidator = {
        validar:        validar,
        formatar:       formatar,
        limpar:         limpar,
        aplicarMascara: aplicarMascara
    };
})();
