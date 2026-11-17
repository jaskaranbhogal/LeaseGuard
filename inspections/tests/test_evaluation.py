"""Verify the evaluation gate, thresholds, and no-network replay mode."""
from copy import deepcopy
from unittest.mock import patch

from django.test import SimpleTestCase

from inspections.evaluation import evaluate, golden_cases, reference_output


class EvaluationTests(SimpleTestCase):
    def test_golden_set_has_at_least_fifteen_cases(self):
        self.assertGreaterEqual(len(golden_cases()), 15)

    def test_replay_passes_without_real_api_calls(self):
        with patch("inspections.services.genai.Client") as client:
            result = evaluate(live=False)
        self.assertTrue(result["passed"], result)
        self.assertEqual(result["max_possible_provider_calls"], 0)
        client.assert_not_called()

    def test_false_damage_hallucination_fails_gate(self):
        def predictor(case):
            result = reference_output(case)
            if case["id"] == "no_change":
                result["classification"] = "damage"
                result["change_detected"] = True
                result["severity"] = "medium"
            return result
        result = evaluate(predictor=predictor)
        self.assertFalse(result["passed"])
        self.assertGreater(result["metrics"]["hallucination_rate"], 0)

    def test_inconsistent_repeats_fail_gate(self):
        calls = {}
        def predictor(case):
            calls[case["id"]] = calls.get(case["id"], 0) + 1
            result = deepcopy(reference_output(case))
            if calls[case["id"]] == 2:
                result["photo_quality"] = "blurry"
            return result
        result = evaluate(predictor=predictor)
        self.assertFalse(result["passed"])
        self.assertEqual(result["metrics"]["consistency"], 0.0)
